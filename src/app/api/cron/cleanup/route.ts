import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET(req: NextRequest) {
  try {
    // Basic auth check for the cron endpoint (Vercel sets this header)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // 1. Find all expired files
    const expiredFiles = await prisma.file.findMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    if (expiredFiles.length === 0) {
      return NextResponse.json({ success: true, message: 'No files to clean up' });
    }

    let deletedCount = 0;
    let failedCount = 0;
    const deletedFileIds: string[] = [];

    // 2. Delete from Cloudinary
    for (const file of expiredFiles) {
      try {
        if (file.cloudinaryUrl) {
          // Extract public_id from Cloudinary URL
          // e.g. https://res.cloudinary.com/demo/image/upload/v1234567890/folder/file.ext
          const parts = file.cloudinaryUrl.split('/');
          const filename = parts.pop();
          const folder = parts.pop();
          const publicId = `${folder}/${filename?.split('.')[0]}`;

          // Delete the original file
          await cloudinary.uploader.destroy(publicId);
          
          // Also try deleting the .pdf version if it was a converted document
          // Cloudinary uploader.destroy ignores missing files
          await cloudinary.uploader.destroy(`${publicId}.pdf`, { resource_type: 'image' });
        }
        
        deletedFileIds.push(file.id);
        deletedCount++;
      } catch (err) {
        console.error(`Failed to delete file ${file.id} from Cloudinary:`, err);
        failedCount++;
      }
    }

    // 3. Delete from Database
    if (deletedFileIds.length > 0) {
      await prisma.file.deleteMany({
        where: { id: { in: deletedFileIds } }
      });
    }

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      failed: failedCount
    });

  } catch (error) {
    console.error('Cron cleanup error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

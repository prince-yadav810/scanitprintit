import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
    console.log('API Key:', process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing');
    console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing');

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to base64 or buffer for Cloudinary
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const fileUri = `data:${file.type};base64,${base64Data}`;

    // Validate size (50MB max for general, 10MB for Office documents)
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isOffice = !!file.name.match(/\.(docx|xlsx|pptx)$/i);

    if (isOffice && file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Office documents must be under 10MB due to conversion limits.' }, { status: 400 });
    } else if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 50MB limit' }, { status: 400 });
    }

    // Upload to Cloudinary
    const uploadOptions: any = {
      folder: 'print-jobs',
    };

    if (isOffice) {
      uploadOptions.resource_type = 'raw';
      uploadOptions.raw_convert = 'aspose';
      // Aspose requires the file extension to determine the type
      uploadOptions.public_id = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    } else {
      uploadOptions.resource_type = 'auto';
      uploadOptions.pages = true;
    }

    const uploadResponse = await cloudinary.uploader.upload(fileUri, uploadOptions);

    let pages = uploadResponse.pages || 1;
    let finalUrl = uploadResponse.secure_url;
    let finalPublicId = uploadResponse.public_id;
    let format = uploadResponse.format || (isOffice ? 'pdf' : 'unknown');

    if (isOffice) {
      // Poll for the converted PDF
      let ready = false;
      let attempts = 0;
      finalPublicId = `${uploadResponse.public_id}.pdf`;
      finalUrl = finalUrl.replace(/\.[^/.]+$/, ".pdf"); // Replace extension with .pdf

      while (!ready && attempts < 15) { // Max 30 seconds
        await new Promise(r => setTimeout(r, 2000));
        try {
          // Cloudinary stores converted PDFs as 'image' resource type to support page manipulation
          const pdfDetails = await cloudinary.api.resource(finalPublicId, {
            resource_type: 'image',
            pages: true
          });
          pages = pdfDetails.pages || 1;
          ready = true;
        } catch (e: any) {
          // If not found yet, keep polling
          if (e?.http_code !== 404) {
            console.error('Error polling for PDF:', e);
          }
        }
        attempts++;
      }

      if (!ready) {
        return NextResponse.json({ error: 'Document conversion timed out or failed. Please ensure the file is not password-protected and try again.' }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: true,
      url: finalUrl,
      publicId: finalPublicId,
      format,
      pages,
      resourceType: isOffice ? 'image' : uploadResponse.resource_type, // PDF is considered image for our preview/printing purposes
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}

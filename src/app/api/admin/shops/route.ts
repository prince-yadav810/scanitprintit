import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { hashPassword } from '@/lib/passwords';

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, ownerUsername, ownerPassword } = await req.json();

    if (!name || !ownerUsername || !ownerPassword) {
      return NextResponse.json({ error: 'Shop name, owner username, and password are required' }, { status: 400 });
    }

    // Check if user username already exists
    const existingUser = await prisma.user.findUnique({ where: { username: ownerUsername } });
    if (existingUser) {
      return NextResponse.json({ error: 'Username is already registered' }, { status: 400 });
    }

    // Generate unique slug
    let slug = slugify(name);
    let existing = await prisma.shop.findUnique({ where: { slug } });
    let counter = 1;
    while (existing) {
      slug = `${slugify(name)}-${counter}`;
      existing = await prisma.shop.findUnique({ where: { slug } });
      counter++;
    }

    const hashedPassword = await hashPassword(ownerPassword);

    const shop = await prisma.shop.create({
      data: {
        name,
        slug,
        status: 'ACTIVE',
        pricingTiers: {
          create: [
            { mode: 'BW', minPages: 1, pricePerPage: 5.0 },
            { mode: 'COLOR', minPages: 1, pricePerPage: 10.0 }
          ]
        },
        user: {
          create: {
            username: ownerUsername,
            password: hashedPassword,
            role: 'SHOP_OWNER'
          }
        }
      },
      include: {
        _count: {
          select: { orders: true }
        },
        agents: true,
        user: {
          select: { username: true }
        }
      }
    });

    return NextResponse.json({ success: true, shop });
  } catch (error) {
    console.error('Shop creation error:', error);
    return NextResponse.json({ error: 'Failed to create shop' }, { status: 500 });
  }
}

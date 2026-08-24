import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Shop name is required' }, { status: 400 });
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
        }
      },
      include: {
        _count: {
          select: { orders: true }
        },
        agents: true
      }
    });

    return NextResponse.json({ success: true, shop });
  } catch (error) {
    console.error('Shop creation error:', error);
    return NextResponse.json({ error: 'Failed to create shop' }, { status: 500 });
  }
}

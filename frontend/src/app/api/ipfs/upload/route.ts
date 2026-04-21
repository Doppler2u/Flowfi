import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const pinataJwt = process.env.PINATA_JWT;

    if (!pinataJwt) {
      return NextResponse.json(
        { error: 'Pinata configuration missing' },
        { status: 500 }
      );
    }

    const payload = {
      pinataOptions: {
        cidVersion: 1,
      },
      pinataMetadata: {
        name: `FlowFiContent_${Date.now()}`,
      },
      pinataContent: data,
    };

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pinataJwt}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error || 'Failed to upload to IPFS' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({ cid: result.IpfsHash });
  } catch (error) {
    console.error('IPFS Upload Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

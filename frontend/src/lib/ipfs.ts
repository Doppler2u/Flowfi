export type ContentMetadata = {
  title: string;
  description: string;
  type: string;
  version: string;
  encryptedData?: {
    ciphertext: string;
    dataToEncryptHash: string;
  };
};

/**
 * Uploads metadata to IPFS via the backend API route.
 * This keeps the Pinata API keys hidden from the frontend.
 */
export async function uploadMetadata(metadata: ContentMetadata): Promise<string> {
  const response = await fetch('/api/ipfs/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to upload metadata to IPFS');
  }

  const { cid } = await response.json();
  return cid;
}

/**
 * Resolves an IPFS CID to its metadata JSON using a public gateway.
 * Includes a fallback list for maximum reliability.
 */
export async function fetchMetadata(cid: string): Promise<ContentMetadata> {
  const gateways = [
    `https://ipfs.io/ipfs/${cid}`,
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
  ];

  for (const url of gateways) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn(`IPFS Fetch failed for ${url}:`, e);
      continue;
    }
  }

  throw new Error('Failed to fetch metadata from all IPFS gateways');
}

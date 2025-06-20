import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Only for development
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

export async function GET() {
  if (!ENABLE_TEST_ENDPOINT) {
    return NextResponse.json({ error: 'Test endpoints disabled in production' }, { status: 403 });
  }
  
  try {
    // Check collections using admin SDK
    const collectionsStatus = {};
    const collectionCounts = {};
    
    const collections = [
      { name: 'surveys' },
      { name: 'test_surveys' },
      { name: 'users' },
      { name: 'conversations' },
      { name: 'messages' },
      { name: 'reports' },
      { name: 'blocks' },
      { name: 'banned_users' }
    ];
    
    // Check each collection
    for (const col of collections) {
      try {
        const colRef = adminDb.collection(col.name);
        const querySnapshot = await colRef.limit(1).get();
        collectionsStatus[col.name] = true;
        
        // Count documents in each collection
        const countSnapshot = await colRef.get();
        collectionCounts[col.name] = countSnapshot.size;
      } catch (error) {
        console.error(`Error checking collection ${col.name}:`, error);
        collectionsStatus[col.name] = false;
        collectionCounts[col.name] = 0;
      }
    }
    
    return NextResponse.json({
      success: true,
      connection: {
        connected: true,
        dbName: 'firestore',
        serverInfo: { version: 'Firebase Firestore' },
        collectionCount: Object.keys(collectionsStatus).length
      },
      collectionNames: Object.keys(collectionsStatus).filter(name => collectionsStatus[name]),
      counts: collectionCounts
    });
  } catch (error) {
    console.error('Error checking connection:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check database connection',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 
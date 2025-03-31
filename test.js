// test-mongo.js
const { MongoClient } = require('mongodb');

async function main() {
  const uri = "mongodb+srv://adhanaesaw:MDPass05@monkeyhouse.hda9vav.mongodb.net/?retryWrites=true&w=majority&appName=MonkeyHouse";
  const client = new MongoClient(uri, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxIdleTimeMS: 30000,
    retryWrites: true,
    retryReads: true
  });

  try {
    console.log("Attempting to connect to MongoDB from airport Wi-Fi...");
    await client.connect();
    console.log("Connected successfully to MongoDB");
    const db = client.db();
    const collections = await db.listCollections().toArray();
    console.log("Collections:", collections);
  } catch (e) {
    console.error("Connection error:", e);
    if (e.name === 'MongoTimeoutError') {
      console.error("Timeout connecting to MongoDB. Airport Wi-Fi might be blocking the connection.");
      console.error("Possible solutions:");
      console.error("1. Try using a mobile hotspot instead of airport Wi-Fi");
      console.error("2. Try connecting through a VPN (or disconnect from VPN if using one)");
      console.error("3. Try again when you have a more stable connection");
    }
  } finally {
    await client.close();
  }
}

main();
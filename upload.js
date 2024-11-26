const { Storage } = require("@google-cloud/storage");
const storage = new Storage();

const bucketName = "file-management-bucket-dwn";
const filePath = "./test.txt"; // Lokasi file lokal untuk diupload

async function uploadFile() {
  try {
    // Periksa atau buat bucket jika belum ada
    const bucket = storage.bucket(bucketName);
    try {
      await bucket.getMetadata();
      console.log(`Bucket "${bucketName}" sudah ada.`);
    } catch {
      await storage.createBucket(bucketName);
      console.log(`Bucket "${bucketName}" berhasil dibuat.`);
    }

    // Upload file
    await bucket.upload(filePath);
    console.log(`${filePath} berhasil diupload ke bucket "${bucketName}".`);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

uploadFile();

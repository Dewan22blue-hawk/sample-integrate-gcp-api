const { Storage } = require("@google-cloud/storage");
const storage = new Storage();

const bucketName = "file-management-bucket-dwn"; // Nama bucket di Google Cloud Storage
const fileName = "test.txt"; // Nama file yang akan diunduh dari bucket
const destination = "./downloaded-test.txt"; // Lokasi penyimpanan file di sistem lokal

async function downloadFile() {
  try {
    await storage.bucket(bucketName).file(fileName).download({ destination });
    console.log(`${fileName} berhasil diunduh ke ${destination}.`);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

downloadFile();

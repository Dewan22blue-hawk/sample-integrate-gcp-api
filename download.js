const { Storage } = require("@google-cloud/storage");
const storage = new Storage();

const bucketName = "file-management-bucket-dwn";
const fileName = "test.txt";
const destination = "./downloaded-test.txt";

async function downloadFile() {
  try {
    await storage.bucket(bucketName).file(fileName).download({ destination });
    console.log(`${fileName} berhasil diunduh ke ${destination}.`);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

downloadFile();

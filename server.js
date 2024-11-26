const Hapi = require("@hapi/hapi");
const { Storage } = require("@google-cloud/storage");
const pool = require("./db");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

const storage = new Storage();
const bucketName = process.env.BUCKET_NAME;
console.log(bucketName);

const init = async () => {
  const server = Hapi.server({
    port: 3000,
    host: "localhost",
    routes: {
      cors: {
        origin: ["*"],
      },
    },
  });

  // Route: Upload File
  server.route({
    method: "POST",
    path: "/upload",
    options: {
      payload: {
        output: "stream",
        allow: "multipart/form-data",
        parse: true,
        multipart: true,
        maxBytes: 10 * 1024 * 1024, // 10MB
      },
    },
    handler: async (request, h) => {
      const { file } = request.payload;

      if (!file) {
        return h.response({ error: "File tidak ditemukan!" }).code(400);
      }

      const fileName = `${Date.now()}-${file.hapi.filename}`;
      const storagePath = `uploads/${fileName}`;

      try {
        // Upload file ke Google Cloud Storage
        const bucket = storage.bucket(bucketName);
        const fileUpload = bucket.file(storagePath);
        const writeStream = fileUpload.createWriteStream({
          metadata: { contentType: file.hapi.headers["content-type"] },
        });

        file.pipe(writeStream);

        await new Promise((resolve, reject) => {
          file.on("end", resolve);
          writeStream.on("error", reject);
          writeStream.on("finish", resolve);
        });

        const publicUrl = `https://storage.googleapis.com/${bucketName}/${storagePath}`;

        // Simpan metadata ke database
        const [result] = await pool.query("INSERT INTO files (file_name, file_url) VALUES (?, ?)", [fileName, publicUrl]);

        return h.response({
          message: "File berhasil diupload!",
          fileId: result.insertId,
          fileName,
          fileUrl: publicUrl,
        });
      } catch (error) {
        console.error(error);
        return h.response({ error: "Gagal mengupload file!" }).code(500);
      }
    },
  });

  // Route: Download File
  server.route({
    method: "GET",
    path: "/download/{id}",
    handler: async (request, h) => {
      const { id } = request.params;

      try {
        // Ambil metadata file dari database
        const [rows] = await pool.query("SELECT * FROM files WHERE id = ?", [id]);
        if (rows.length === 0) {
          return h.response({ error: "File tidak ditemukan!" }).code(404);
        }

        const file = rows[0];
        const bucket = storage.bucket(bucketName);
        const fileDownload = bucket.file(`uploads/${file.file_name}`);
        const tempPath = path.join(__dirname, "temp", file.file_name);

        // Download file ke lokasi sementara
        await fileDownload.download({ destination: tempPath });

        const stream = fs.createReadStream(tempPath);
        stream.on("end", () => fs.unlinkSync(tempPath));

        return h.response(stream).header("Content-Type", "application/octet-stream").header("Content-Disposition", `attachment; filename=${file.file_name}`);
      } catch (error) {
        console.error(error);
        return h.response({ error: "Gagal mendownload file!" }).code(500);
      }
    },
  });

  // Start server
  await server.start();
  console.log(`Server berjalan pada ${server.info.uri}`);
};

process.on("unhandledRejection", (err) => {
  console.error(err);
  process.exit(1);
});

init();

const Hapi = require("@hapi/hapi");
const { Storage } = require("@google-cloud/storage"); // Library Google Cloud Storage
const pool = require("./db"); // Pool koneksi database (dikonfigurasi terpisah)
const dotenv = require("dotenv"); // Library untuk membaca file .env
const fs = require("fs"); // Library Node.js untuk manipulasi file
const path = require("path"); // Library untuk manipulasi path file

dotenv.config(); // Menginisialisasi dotenv agar dapat membaca variabel di file .env

const storage = new Storage(); // Inisialisasi client GCP Storage
const bucketName = process.env.BUCKET_NAME; // Nama bucket diambil dari .env
console.log(bucketName); // debugging untuk cek nama bucket sudah ada

const init = async () => {
  const server = Hapi.server({
    port: 3000, // Port server
    host: "localhost", // Host server
    routes: {
      cors: {
        origin: ["*"], // Mengaktifkan CORS untuk semua origin
      },
    },
  });

  // endpoint Upload File
  server.route({
    method: "POST",
    path: "/upload",
    options: {
      payload: {
        output: "stream", // Input akan diproses sebagai stream
        allow: "multipart/form-data", // Format yang diterima adalah form-data
        parse: true, // Parsing otomatis payload
        multipart: true, // Memastikan payload berisi multipart data
        maxBytes: 10 * 1024 * 1024, // Maksimal ukuran file adalah 10MB
      },
    },
    handler: async (request, h) => {
      const { file } = request.payload; // Mengambil file dari request payload

      if (!file) {
        return h.response({ error: "File tidak ditemukan!" }).code(400);
      }

      const fileName = `${Date.now()}-${file.hapi.filename}`; // Nama file unik
      const storagePath = `uploads/${fileName}`; // Lokasi penyimpanan di bucket

      try {
        const bucket = storage.bucket(bucketName); // Ambil referensi bucket
        const fileUpload = bucket.file(storagePath); // File di dalam bucket
        const writeStream = fileUpload.createWriteStream({
          metadata: { contentType: file.hapi.headers["content-type"] }, // Metadata file
        });

        // Streaming file ke Google Cloud Storage
        file.pipe(writeStream);

        await new Promise((resolve, reject) => {
          file.on("end", resolve); // Resolusi ketika upload selesai
          writeStream.on("error", reject); // Error saat upload
          writeStream.on("finish", resolve); // Resolusi ketika stream selesai
        });

        const publicUrl = `https://storage.googleapis.com/${bucketName}/${storagePath}`; // URL publik file

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

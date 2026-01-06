
console.log("Checking environment variables...");
if (process.env.BLOB_READ_WRITE_TOKEN) {
    console.log("BLOB_READ_WRITE_TOKEN is set.");
    console.log("Length:", process.env.BLOB_READ_WRITE_TOKEN.length);
} else {
    console.log("BLOB_READ_WRITE_TOKEN is NOT set.");
}

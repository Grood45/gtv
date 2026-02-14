const timestamp = 1771076828;
const date = new Date(timestamp * 1000);
const now = new Date();

console.log("Timestamp:", timestamp);
console.log("Expiry Date (Local):", date.toString());
console.log("Current Date (Local):", now.toString());

const diff = (date - now) / 1000 / 60; // difference in minutes
console.log(`Expires in: ${diff.toFixed(2)} minutes`);

if (diff < 0) {
    console.log("❌ URL is EXPIRED");
} else {
    console.log("✅ URL is VALID");
}

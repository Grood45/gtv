const url = "https://www.glivestreaming.com/livetv/12/9w/gugo/19769266/9w3bcwgn006770f6/4166218eeeeaf5eb1c8e34e55f7affff/13.205.138.70/1771076828?=&lang=en";
const regex = /\/(\d{10})(\?|$)/;
const match = url.match(regex);

if (match) {
    console.log("Full match:", match[0]);
    console.log("Timestamp:", match[1]);
    const ts = parseInt(match[1]);
    console.log("Date:", new Date(ts * 1000).toString());
} else {
    console.log("No match found");
}

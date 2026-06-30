const cloudinary = require('cloudinary').v2;

// 1. Configure Cloudinary
cloudinary.config({
  cloud_name: 'dvempuvvz',
  api_key: '286167645161612',
  api_secret: 'KoR2VXYFvlgQjD4YLOwDKEBEYlI'
});

async function run() {
  try {
    const sampleUrl = 'https://res.cloudinary.com/demo/image/upload/dog.jpg';
    
    console.log("Uploading sample image...");
    // 2. Upload an image
    const uploadResult = await cloudinary.uploader.upload(sampleUrl);
    console.log("Secure URL: " + uploadResult.secure_url);
    console.log("Public ID: " + uploadResult.public_id);
    
    // 3. Get image details
    console.log("Width: " + uploadResult.width);
    console.log("Height: " + uploadResult.height);
    console.log("Format: " + uploadResult.format);
    console.log("File Size (bytes): " + uploadResult.bytes);
    
    // 4. Transform the image
    // Generate a transformed version of the image URL using both f_auto and q_auto
    const transformedUrl = cloudinary.url(uploadResult.public_id, {
      fetch_format: 'auto', // f_auto: Automatically delivers the image in the most optimized format supported by the user's browser (e.g. WebP, AVIF)
      quality: 'auto',      // q_auto: Automatically adjusts the image quality compression to deliver optimal visual quality with minimal file size
      secure: true
    });
    
    console.log("Done! Click link below to see optimized version of the image. Check the size and the format.");
    console.log(transformedUrl);
  } catch (error) {
    console.error("Error running script:", error);
  }
}

run();

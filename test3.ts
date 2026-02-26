import { pipeline } from '@huggingface/transformers';
import fs from 'fs';

async function test() {
  try {
    console.log('Loading model...');
    const classifier = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
    console.log('Model loaded. Classifying...');
    
    // Download a real image
    const res = await fetch('https://picsum.photos/seed/2094/400/400');
    const buffer = await res.arrayBuffer();
    fs.writeFileSync('dummy.jpg', Buffer.from(buffer));
    
    const result = await classifier('dummy.jpg', ['planter', 'urn', 'garden ball', 'fountain']);
    console.log(result);
  } catch (err) {
    console.error(err);
  }
}

test();

import fs from 'fs';

async function test() {
  try {
    const formData = new FormData();
    const file = new Blob([fs.readFileSync('dummy.jpg')], { type: 'image/jpeg' });
    formData.append('image', file, 'dummy.jpg');

    console.log('Sending request...');
    const res = await fetch('http://localhost:3000/api/search-by-image', {
      method: 'POST',
      body: formData
    });
    
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();

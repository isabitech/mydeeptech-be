// Simple test for chat API
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGRmNTAwMGEyZDZlZDdiMmQyZmY1N2EiLCJlbWFpbCI6ImRhbWlsb2xhbWlyYWNsZWtAZ21haWwuY29tIiwiZnVsbE5hbWUiOiJEYW1pbG9sYSBLb2xhd29sZSIsImlhdCI6MTczMjA3ODIwNH0.zHnyuOc9d_FbBEwQbJNPFm_i4wBzIGr6A8Nc8LDPnxk';

fetch('http://localhost:5000/api/chat/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "Hello! I need help with my account",
    category: "general_inquiry",
    priority: "medium"
  })
})
.then(response => response.json())
.then(data => {
  console.log('🎉 CHAT API SUCCESS!');
  console.log(JSON.stringify(data, null, 2));
})
.catch(error => {
  console.error('❌ Error:', error);
});
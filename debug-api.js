// API Debug Script
// Run this script to test your API endpoints manually

async function testApiEndpoint() {
  console.log("🔍 Testing API endpoints...\n");
  
  // Test plot data endpoint
  console.log("📡 Testing /api/plots endpoint:");
  try {
    const response = await fetch('http://localhost:3000/api/plots', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('Content-Type')}`);
    console.log(`URL: ${response.url}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log("❌ Error Response Body:");
      console.log(errorText.substring(0, 500));
      return;
    }

    const contentType = response.headers.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await response.text();
      console.log("⚠️ Expected JSON but got:");
      console.log(`Content-Type: ${contentType}`);
      console.log("Response preview:");
      console.log(responseText.substring(0, 200));
      return;
    }

    const data = await response.json();
    console.log("✅ Success! Response structure:");
    console.log(`- Type: ${Array.isArray(data) ? 'Array' : typeof data}`);
    console.log(`- Length: ${Array.isArray(data) ? data.length : 'N/A'}`);
    
    if (Array.isArray(data) && data.length > 0) {
      console.log("- First item structure:");
      console.log(JSON.stringify(data[0], null, 2));
    }
    
  } catch (error) {
    console.error("❌ Fetch error:", error.message);
  }

  console.log("\n" + "=".repeat(50) + "\n");

  // Test order creation endpoint
  console.log("📮 Testing /api/orders endpoint:");
  try {
    const testOrder = {
      plotId: "test-plot-1",
      name: "Test User",
      email: "test@example.com",
      phone: "+255123456789",
      notes: "Test order",
      timestamp: new Date().toISOString(),
    };

    const response = await fetch('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testOrder),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('Content-Type')}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log("❌ Error Response Body:");
      console.log(errorText.substring(0, 500));
      return;
    }

    const result = await response.json();
    console.log("✅ Order creation successful!");
    console.log("Response:", JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error("❌ Order creation error:", error.message);
  }
}

// Run the test
testApiEndpoint().catch(console.error);

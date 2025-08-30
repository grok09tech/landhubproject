#!/usr/bin/env python3
import logging
logging.basicConfig(level=logging.DEBUG)

try:
    from database import get_db, engine
    from services.order_service import OrderService
    from services.plot_service import PlotService
    from schemas import PlotOrderCreate
    from sqlalchemy.orm import Session

    print("✓ All imports successful")

    # Test database connection
    from sqlalchemy import text
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print("✓ Database connection successful")

    # Test services
    plot_service = PlotService()
    order_service = OrderService()
    print("✓ Services initialized successfully")

    # Test plot lookup
    plot_id = 'b6af8500-70d6-4e76-b56f-2e013e22fc39'
    db = next(get_db())
    plot = plot_service.get_plot_by_id(db, plot_id)
    if plot:
        print(f"✓ Plot found: {plot.id}, status: {plot.status}")
    else:
        print("✗ Plot not found")
        exit(1)

    # Test order creation data
    order_data = PlotOrderCreate(
        first_name="Test",
        last_name="User",
        customer_phone="0786666666",
        customer_email="test@example.com"
    )
    print(f"✓ Order data created: {order_data.first_name} {order_data.last_name}")

    # Test order creation
    print("Creating order...")
    order = order_service.create_order(db, plot_id, order_data)
    print(f"✓ Order created successfully: {order.id}")

    # Check if order was saved
    from models import PlotOrder
    saved_order = db.query(PlotOrder).filter(PlotOrder.id == order.id).first()
    if saved_order:
        print(f"✓ Order saved in database: {saved_order.first_name} {saved_order.last_name}")
    else:
        print("✗ Order not found in database")

    db.close()
    print("✓ Test completed successfully")

except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()

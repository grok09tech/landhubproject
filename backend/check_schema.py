#!/usr/bin/env python3
from database import engine
from sqlalchemy import text

def check_table_schema():
    with engine.connect() as conn:
        # Check plot_orders table structure
        result = conn.execute(text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'plot_orders'
            ORDER BY ordinal_position;
        """))

        print("plot_orders table structure:")
        for row in result:
            print(f"  {row.column_name}: {row.data_type} ({'NULL' if row.is_nullable == 'YES' else 'NOT NULL'})")

        # Check if table has data
        count_result = conn.execute(text("SELECT COUNT(*) FROM plot_orders;"))
        count = count_result.fetchone()[0]
        print(f"\nTotal orders in database: {count}")

        # Check land_plots table
        plot_result = conn.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'land_plots'
            ORDER BY ordinal_position;
        """))

        print("\nland_plots table structure:")
        for row in plot_result:
            print(f"  {row.column_name}: {row.data_type} ({'NULL' if row.is_nullable == 'YES' else 'NOT NULL'})")

if __name__ == "__main__":
    check_table_schema()

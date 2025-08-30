#!/usr/bin/env python3
from database import engine
from sqlalchemy import text

def check_plot_exists():
    plot_id = 'b6af8500-70d6-4e76-b56f-2e013e22fc39'

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id, plot_code, status
            FROM land_plots
            WHERE id = :plot_id
        """), {"plot_id": plot_id})

        row = result.fetchone()
        if row:
            print(f"Plot found:")
            print(f"  ID: {row.id}")
            print(f"  Code: {row.plot_code}")
            print(f"  Status: {row.status}")
        else:
            print(f"Plot with ID {plot_id} not found")

        # Also check total number of plots
        count_result = conn.execute(text("SELECT COUNT(*) FROM land_plots;"))
        total_plots = count_result.fetchone()[0]
        print(f"\nTotal plots in database: {total_plots}")

if __name__ == "__main__":
    check_plot_exists()

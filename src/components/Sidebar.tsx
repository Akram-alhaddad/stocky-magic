
import { Link, useLocation } from "react-router-dom";
import { BarChart, Package, TrendingDown, LayoutDashboard, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const Sidebar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    {
      path: "/",
      icon: LayoutDashboard,
      label: "لوحة التحكم"
    },
    {
      path: "/items",
      icon: Package,
      label: "الأصناف"
    },
    {
      path: "/dispense",
      icon: TrendingDown,
      label: "أمر/طلب (صرف مخزني)"
    },
    {
      path: "/reports",
      icon: BarChart,
      label: "التقارير"
    }
  ];

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 right-4 z-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Menu className="h-6 w-6" />
      </Button>

      <div 
        className={cn(
          "fixed inset-y-0 right-0 w-64 bg-white border-l border-gray-200 transform transition-transform duration-300 ease-in-out shadow-lg",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="pt-16 px-4">
          <div className="space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center px-4 py-2 rounded-lg transition-colors",
                  location.pathname === item.path
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-gray-100",
                  "font-arabic"
                )}
              >
                <item.icon className="h-5 w-5 ml-3" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;

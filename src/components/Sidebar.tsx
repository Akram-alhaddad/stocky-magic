
import { Link, useLocation } from "react-router-dom";
import { BarChart, Package, TrendingDown, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const Sidebar = () => {
  const location = useLocation();
  const [language] = useState<"en" | "ar">("ar");
  const [isCollapsed, setIsCollapsed] = useState(true);

  const menuItems = [
    {
      path: "/",
      icon: LayoutDashboard,
      labelAr: "لوحة التحكم",
      labelEn: "Dashboard"
    },
    {
      path: "/items",
      icon: Package,
      labelAr: "الأصناف",
      labelEn: "Items"
    },
    {
      path: "/dispense",
      icon: TrendingDown,
      labelAr: "أمر/طلب (صرف مخزني)",
      labelEn: "Dispense"
    },
    {
      path: "/reports",
      icon: BarChart,
      labelAr: "التقارير",
      labelEn: "Reports"
    }
  ];

  return (
    <div 
      className={cn(
        "relative bg-white border-l border-gray-200 transition-all duration-300",
        isCollapsed ? "w-12" : "w-64"
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute -left-4 top-2 z-50"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? <ChevronLeft /> : <ChevronRight />}
      </Button>

      <div className="space-y-4 py-4">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center px-4 py-2 mx-2 rounded-lg transition-colors",
              location.pathname === item.path
                ? "bg-primary text-primary-foreground"
                : "hover:bg-gray-100",
              language === "ar" ? "font-arabic" : "font-english",
              isCollapsed ? "justify-center" : "justify-start"
            )}
          >
            <item.icon className="h-5 w-5" />
            {!isCollapsed && (
              <span className="mr-3">{language === "ar" ? item.labelAr : item.labelEn}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;

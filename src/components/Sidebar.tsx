
import { Link, useLocation } from "react-router-dom";
import { BarChart, Package, TrendingDown, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const Sidebar = () => {
  const location = useLocation();
  const [language, setLanguage] = useState<"en" | "ar">("ar");

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
      labelAr: "صرف المخزون",
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
    <div className="w-64 bg-white border-r border-gray-200 p-4">
      <div className="space-y-4">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors",
              location.pathname === item.path
                ? "bg-primary text-primary-foreground"
                : "hover:bg-gray-100",
              language === "ar" ? "font-arabic" : "font-english"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{language === "ar" ? item.labelAr : item.labelEn}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;

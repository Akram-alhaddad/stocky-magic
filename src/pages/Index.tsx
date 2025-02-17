
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { getDB } from "@/lib/db";
import { Package, TrendingDown, AlertTriangle } from "lucide-react";
import { useState } from "react";

const Index = () => {
  const [language] = useState<"en" | "ar">("ar");
  
  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const db = await getDB();
      return db.getAll('items');
    }
  });

  const { data: transactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const db = await getDB();
      return db.getAll('transactions');
    }
  });

  const totalItems = items?.length || 0;
  const totalDispensed = transactions?.filter(t => t.type === 'out').length || 0;
  const lowStockItems = items?.filter(item => item.quantity <= item.minQuantity).length || 0;

  const stats = [
    {
      title: language === "ar" ? "إجمالي الأصناف" : "Total Items",
      value: totalItems,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: language === "ar" ? "عمليات الصرف" : "Dispensed Items",
      value: totalDispensed,
      icon: TrendingDown,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: language === "ar" ? "أصناف تحت الحد الأدنى" : "Low Stock Items",
      value: lowStockItems,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-100"
    }
  ];

  return (
    <div className="space-y-6">
      <h1 className={`text-3xl font-bold ${language === "ar" ? "font-arabic" : "font-english"}`}>
        {language === "ar" ? "لوحة التحكم" : "Dashboard"}
      </h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`${stat.bgColor} ${stat.color} p-2 rounded-full`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {lowStockItems > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className={`text-red-700 ${language === "ar" ? "font-arabic" : "font-english"}`}>
              {language === "ar" ? "تنبيه المخزون" : "Stock Alert"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-red-600 ${language === "ar" ? "font-arabic" : "font-english"}`}>
              {language === "ar" 
                ? `يوجد ${lowStockItems} صنف تحت الحد الأدنى للمخزون`
                : `${lowStockItems} items are below minimum stock level`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Index;

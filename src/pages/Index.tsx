
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { getDB } from "@/lib/db";
import { Package, TrendingDown, AlertTriangle, BarChart3 } from "lucide-react";
import { useState } from "react";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";

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
      title: "إجمالي الأصناف",
      value: totalItems,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "عمليات الصرف",
      value: totalDispensed,
      icon: TrendingDown,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "أصناف تحت الحد الأدنى",
      value: lowStockItems,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-100"
    }
  ];

  // Prepare chart data
  const departmentData = transactions?.reduce((acc, transaction) => {
    const dept = acc.find(d => d.department === transaction.department);
    if (dept) {
      dept.count += 1;
    } else {
      acc.push({ department: transaction.department, count: 1 });
    }
    return acc;
  }, [] as { department: string; count: number }[]) || [];

  return (
    <div className="space-y-6 p-6 rtl">
      <h1 className="text-3xl font-bold font-arabic mb-8">
        نظام إدارة المخزون المحلي
      </h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground font-arabic">
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
            <CardTitle className="text-red-700 font-arabic">
              تنبيه المخزون
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 font-arabic">
              يوجد {lowStockItems} صنف تحت الحد الأدنى للمخزون
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-arabic">توزيع الصرف حسب القسم</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveBar
                data={departmentData}
                keys={['count']}
                indexBy="department"
                margin={{ top: 50, right: 50, bottom: 100, left: 60 }}
                padding={0.3}
                valueScale={{ type: 'linear' }}
                indexScale={{ type: 'band', round: true }}
                colors={{ scheme: 'nivo' }}
                axisBottom={{
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: -45,
                  legend: 'القسم',
                  legendPosition: 'middle',
                  legendOffset: 70
                }}
                axisLeft={{
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: 0,
                  legend: 'عدد العمليات',
                  legendPosition: 'middle',
                  legendOffset: -40
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-arabic">حركة المخزون</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveLine
                data={[
                  {
                    id: "المخزون",
                    data: items?.map(item => ({
                      x: item.name,
                      y: item.quantity
                    })) || []
                  }
                ]}
                margin={{ top: 50, right: 50, bottom: 100, left: 60 }}
                xScale={{ type: 'point' }}
                yScale={{ type: 'linear', min: 0, max: 'auto' }}
                axisBottom={{
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: -45,
                  legend: 'الصنف',
                  legendOffset: 70,
                  legendPosition: 'middle'
                }}
                axisLeft={{
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: 0,
                  legend: 'الكمية',
                  legendOffset: -40,
                  legendPosition: 'middle'
                }}
                pointSize={10}
                pointColor={{ theme: 'background' }}
                pointBorderWidth={2}
                pointBorderColor={{ from: 'serieColor' }}
                enablePointLabel={true}
                pointLabel="y"
                pointLabelYOffset={-12}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;

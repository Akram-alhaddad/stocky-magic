
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDB } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { jsPDF } from "jspdf";
import { FileDown } from "lucide-react";

export default function Reports() {
  const { data: reportData } = useQuery({
    queryKey: ["report-data"],
    queryFn: async () => {
      const db = await getDB();
      const items = await db.getAll("items");
      const transactions = await db.getAll("transactions");
      
      // Process data for charts
      const itemQuantities = items.map(item => ({
        item: item.nameAr,
        quantity: item.quantity
      }));
      
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();
      
      const dailyTransactions = last7Days.map(date => ({
        x: date,
        y: transactions.filter(t => 
          new Date(t.date).toISOString().split('T')[0] === date
        ).length
      }));
      
      return {
        items,
        transactions,
        itemQuantities,
        dailyTransactions
      };
    }
  });

  const generatePDF = () => {
    // إضافة دعم للغة العربية
    const doc = new jsPDF();
    doc.addFont("public/fonts/NotoNaskhArabic-Regular.ttf", "NotoNaskhArabic", "normal");
    doc.setFont("NotoNaskhArabic");
    
    doc.setFontSize(24);
    doc.text("تقرير المخزون", 105, 20, { align: "center" });
    
    doc.setFontSize(14);
    
    let yPos = 40;
    
    // ملخص المخزون
    doc.text("ملخص المخزون:", 190, yPos, { align: "right" });
    yPos += 10;
    
    reportData?.items.forEach(item => {
      doc.text(`${item.nameAr}: ${item.quantity}`, 180, yPos, { align: "right" });
      yPos += 8;
    });
    
    // إضافة المزيد من التفاصيل
    yPos += 15;
    doc.text("إحصائيات عامة:", 190, yPos, { align: "right" });
    yPos += 10;
    
    const totalItems = reportData?.items.length || 0;
    const lowStockItems = reportData?.items.filter(item => item.quantity <= item.minQuantity).length || 0;
    const totalTransactions = reportData?.transactions.length || 0;
    
    doc.text(`إجمالي الأصناف: ${totalItems}`, 180, yPos, { align: "right" });
    yPos += 8;
    doc.text(`الأصناف منخفضة المخزون: ${lowStockItems}`, 180, yPos, { align: "right" });
    yPos += 8;
    doc.text(`إجمالي المعاملات: ${totalTransactions}`, 180, yPos, { align: "right" });
    
    // إضافة التوقيعات
    yPos = 250;
    
    // المستلم
    doc.text("المستلم:", 170, yPos, { align: "right" });
    doc.text("التوقيع:", 170, yPos + 20, { align: "right" });
    
    // أمين المخزن
    doc.text("أمين المخزن:", 60, yPos, { align: "left" });
    doc.text("التوقيع:", 60, yPos + 20, { align: "left" });
    
    // إضافة خطوط التوقيع
    doc.setDrawColor(0);
    doc.line(120, yPos + 20, 170, yPos + 20); // خط توقيع المستلم
    doc.line(20, yPos + 20, 70, yPos + 20);   // خط توقيع أمين المخزن
    
    // إضافة التاريخ
    const today = new Date();
    doc.text(`تاريخ التقرير: ${today.toLocaleDateString('ar-SA')}`, 190, 280, { align: "right" });
    
    doc.save("تقرير-المخزون.pdf");
  };

  return (
    <div className="p-6 min-h-screen w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold font-arabic">
          التقارير
        </h1>
        
        <Button onClick={generatePDF}>
          <FileDown className="ml-2 h-4 w-4" />
          تصدير PDF
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h2 className="text-lg font-medium mb-4 font-arabic">
            كميات المخزون
          </h2>
          <div className="h-[400px]">
            {reportData?.itemQuantities && (
              <ResponsiveBar
                data={reportData.itemQuantities}
                keys={["quantity"]}
                indexBy="item"
                margin={{ top: 50, right: 50, bottom: 50, left: 60 }}
                padding={0.3}
                colors={{ scheme: "nivo" }}
                axisBottom={{
                  tickRotation: -45
                }}
              />
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-medium mb-4 font-arabic">
            المعاملات اليومية
          </h2>
          <div className="h-[400px]">
            {reportData?.dailyTransactions && (
              <ResponsiveLine
                data={[
                  {
                    id: "المعاملات",
                    data: reportData.dailyTransactions
                  }
                ]}
                margin={{ top: 50, right: 50, bottom: 50, left: 60 }}
                xScale={{ type: "point" }}
                yScale={{ type: "linear", min: 0, max: "auto" }}
                curve="monotoneX"
                enablePointLabel={true}
                pointSize={10}
                pointColor={{ theme: "background" }}
                pointBorderWidth={2}
                pointBorderColor={{ from: "serieColor" }}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

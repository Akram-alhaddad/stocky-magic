
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDB } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { jsPDF } from "jspdf";

export default function Reports() {
  const [language, setLanguage] = useState<"en" | "ar">("ar");

  const { data: reportData } = useQuery({
    queryKey: ["report-data"],
    queryFn: async () => {
      const db = await getDB();
      const items = await db.getAll("items");
      const transactions = await db.getAll("transactions");
      
      // Process data for charts
      const itemQuantities = items.map(item => ({
        item: language === "ar" ? item.nameAr : item.name,
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
    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(language === "ar" ? "تقرير المخزون" : "Inventory Report", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    
    let yPos = 40;
    
    // Add inventory summary
    doc.text(language === "ar" ? "ملخص المخزون" : "Inventory Summary", 20, yPos);
    yPos += 10;
    
    reportData?.items.forEach(item => {
      const line = `${language === "ar" ? item.nameAr : item.name}: ${item.quantity}`;
      doc.text(line, 30, yPos);
      yPos += 10;
    });
    
    // Add transactions summary
    yPos += 10;
    doc.text(language === "ar" ? "ملخص المعاملات" : "Transactions Summary", 20, yPos);
    yPos += 10;
    
    const totalOut = reportData?.transactions.filter(t => t.type === "out").length || 0;
    doc.text(`${language === "ar" ? "إجمالي المعاملات" : "Total Transactions"}: ${totalOut}`, 30, yPos);
    
    doc.save("inventory-report.pdf");
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className={`text-2xl font-bold ${language === "ar" ? "font-arabic" : "font-english"}`}>
          {language === "ar" ? "التقارير" : "Reports"}
        </h1>
        
        <Button onClick={generatePDF}>
          {language === "ar" ? "تصدير PDF" : "Export PDF"}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h2 className={`text-lg font-medium mb-4 ${language === "ar" ? "font-arabic" : "font-english"}`}>
            {language === "ar" ? "كميات المخزون" : "Inventory Quantities"}
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
          <h2 className={`text-lg font-medium mb-4 ${language === "ar" ? "font-arabic" : "font-english"}`}>
            {language === "ar" ? "المعاملات اليومية" : "Daily Transactions"}
          </h2>
          <div className="h-[400px]">
            {reportData?.dailyTransactions && (
              <ResponsiveLine
                data={[
                  {
                    id: language === "ar" ? "المعاملات" : "Transactions",
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

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDB, departments, units, capacityUnits } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { arSA } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { 
  PrinterIcon, 
  FileDown, 
  Save, 
  CalendarIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DispenseItem {
  itemId: string;
  quantity: number;
  unit?: string;
  capacity?: number;
  capacityUnit?: string;
  notes?: string;
}

interface Transaction {
  id: string;
  date: Date;
  department: string;
  items: DispenseItem[];
  type: 'in' | 'out';
}

export default function Dispense() {
  const [date, setDate] = useState<Date>(new Date());
  const [department, setDepartment] = useState("none");
  const [dispenseItems, setDispenseItems] = useState<DispenseItem[]>(
    Array(10).fill({ itemId: "", quantity: 0 })
  );
  const [activeTab, setActiveTab] = useState("new");
  const [reportType, setReportType] = useState("all");
  const [reportPeriod, setReportPeriod] = useState("monthly");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const db = await getDB();
      return db.getAll("items");
    }
  });

  const { data: transactions } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const db = await getDB();
      const allTransactions = await db.getAll("transactions");
      return allTransactions as Transaction[];
    }
  });

  const dispenseItemMutation = useMutation({
    mutationFn: async ({ items, department, date }: { items: DispenseItem[], department: string, date: Date }) => {
      const db = await getDB();
      
      const validItems = items.filter(item => item.itemId && item.quantity > 0);
      
      for (const dispenseItem of validItems) {
        const item = await db.get("items", dispenseItem.itemId);
        if (!item) throw new Error("الصنف غير موجود");
        if (item.quantity < dispenseItem.quantity) {
          throw new Error(`الكمية غير كافية للصنف ${item.nameAr}`);
        }
      }
      
      for (const dispenseItem of validItems) {
        const item = await db.get("items", dispenseItem.itemId);
        await db.put("items", {
          ...item,
          quantity: item.quantity - dispenseItem.quantity,
          lastUpdated: new Date()
        });
      }
      
      const transactionId = crypto.randomUUID();
      await db.add("transactions", {
        id: transactionId,
        date,
        department,
        items: validItems,
        type: "out"
      });
      
      return { transactionId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({
        title: "تم بنجاح",
        description: "تم صرف المخزون بنجاح"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const generatePDF = (transaction?: Transaction) => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      doc.setR2L(true);
      
      const logoPath = '/lovable-uploads/827ec35a-05da-43be-99c3-b490062605d1.png';
      doc.addImage(logoPath, 'PNG', doc.internal.pageSize.getWidth() / 2 - 30, 20, 60, 30);
      
      doc.setFontSize(20);
      doc.text("طلب/أمر (صرف مخزني)", doc.internal.pageSize.getWidth() / 2, 65, { align: "center" });

      doc.setFontSize(12);
      doc.text(":اليوم", doc.internal.pageSize.getWidth() - 30, 30);
      doc.text(":التاريخ", doc.internal.pageSize.getWidth() - 30, 40);
      doc.text(":القسم", doc.internal.pageSize.getWidth() - 30, 50);

      doc.text(format(date, 'yyyy/MM/dd'), doc.internal.pageSize.getWidth() - 60, 40);
      doc.text(department === 'none' ? '-' : department, doc.internal.pageSize.getWidth() - 60, 50);

      const startY = 80;
      const rowHeight = 10;
      const margin = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const tableWidth = pageWidth - (2 * margin);
      const colWidths = [25, 35, 25, 25, 35, 35];
      
      const headers = ["م", "الصنف", "الوحدة", "الكمية", "العبوة/السعة", "ملاحظات"];
      let currentX = pageWidth - margin;
      
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, startY, tableWidth, rowHeight, 'F');
      
      headers.forEach((header, i) => {
        currentX -= colWidths[i];
        doc.text(header, currentX + (colWidths[i] / 2), startY + 7, { align: "center" });
      });

      let currentY = startY + rowHeight;
      
      for (let i = 0; i < 10; i++) {
        const item = dispenseItems[i] || { itemId: "", quantity: 0 };
        const foundItem = items?.find(it => it.id === item.itemId);
        
        currentX = pageWidth - margin;
        doc.line(margin, currentY, pageWidth - margin, currentY);
        
        const rowData = [
          (i + 1).toString(),
          foundItem?.nameAr || "",
          item.unit || "",
          item.quantity ? item.quantity.toString() : "",
          `${item.capacity || ""} ${item.capacityUnit || ""}`.trim(),
          item.notes || ""
        ];

        rowData.forEach((text, j) => {
          currentX -= colWidths[j];
          doc.text(text, currentX + (colWidths[j] / 2), currentY + 7, { align: "center" });
        });

        currentY += rowHeight;
      }

      doc.line(margin, currentY, pageWidth - margin, currentY);

      let verticalX = margin;
      for (let i = 0; i <= colWidths.length; i++) {
        doc.line(verticalX, startY, verticalX, currentY);
        verticalX += colWidths[i];
      }

      currentY += 20;
      
      doc.text("المستلم:", pageWidth - 30, currentY);
      doc.text("التوقيع:", pageWidth - 30, currentY + 15);
      
      doc.text("أمين المخازن:", 60, currentY);
      doc.text("التوقيع:", 60, currentY + 15);
      
      doc.text("المحاسب:", 60, currentY + 30);

      const fileName = transaction 
        ? `أمر-صرف-${transaction.id.substring(0, 8)}.pdf` 
        : `أمر-صرف-${format(date, 'yyyy-MM-dd')}.pdf`;
      
      doc.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إنشاء ملف PDF",
        variant: "destructive"
      });
    }
  };

  const generateReportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      doc.setR2L(true);
      
      let filteredTransactions = transactions?.filter(t => t.type === "out") || [];
      
      if (filterDepartment !== "all") {
        filteredTransactions = filteredTransactions.filter(t => t.department === filterDepartment);
      }

      filteredTransactions = filteredTransactions.filter(t => {
        const transactionDate = new Date(t.date);
        return isWithinInterval(transactionDate, { start: startDate, end: endDate });
      });

      let reportTitle = "تقرير الصرف المخزني";
      if (reportPeriod === "monthly") {
        reportTitle += ` - شهر ${format(startDate, 'MMMM yyyy', { locale: arSA })}`;
      } else if (reportPeriod === "yearly") {
        reportTitle += ` - سنة ${format(startDate, 'yyyy')}`;
      } else {
        reportTitle += ` - من ${format(startDate, 'yyyy/MM/dd')} إلى ${format(endDate, 'yyyy/MM/dd')}`;
      }
      
      if (filterDepartment !== "all") {
        reportTitle += ` - قسم ${filterDepartment}`;
      }

      doc.text(reportTitle, doc.internal.pageSize.getWidth() / 2, 20, { align: "center" });

      if (filteredTransactions.length === 0) {
        doc.setFontSize(14);
        doc.text("لا توجد بيانات للعرض في هذه الفترة", doc.internal.pageSize.getWidth() / 2, 50, { align: "center" });
        doc.save(`تقرير-الصرف-المخزني.pdf`);
        return;
      }

      let reportData: any[] = [];
      
      if (reportType === "all") {
        reportData = filteredTransactions.map(t => ({
          id: t.id.substring(0, 8),
          date: format(new Date(t.date), 'yyyy/MM/dd'),
          department: t.department === 'none' ? 'غير محدد' : t.department,
          itemCount: t.items.length,
          totalQuantity: t.items.reduce((sum, item) => sum + item.quantity, 0)
        }));
      } else if (reportType === "byDepartment") {
        const deptSummary = new Map();
        
        filteredTransactions.forEach(t => {
          const deptName = t.department === 'none' ? 'غير محدد' : t.department;
          
          if (!deptSummary.has(deptName)) {
            deptSummary.set(deptName, { 
              count: 0, 
              totalQuantity: 0,
              itemsCount: 0
            });
          }
          
          const deptData = deptSummary.get(deptName);
          deptData.count += 1;
          deptData.itemsCount += t.items.length;
          deptData.totalQuantity += t.items.reduce((sum, item) => sum + item.quantity, 0);
        });
        
        reportData = Array.from(deptSummary.entries()).map(([dept, data]) => ({
          department: dept,
          count: data.count,
          itemsCount: data.itemsCount,
          totalQuantity: data.totalQuantity
        }));
      } else if (reportType === "byItem") {
        const itemSummary = new Map();
        
        filteredTransactions.forEach(t => {
          t.items.forEach(item => {
            if (!item.itemId) return;
            
            const foundItem = items?.find(i => i.id === item.itemId);
            if (!foundItem) return;
            
            if (!itemSummary.has(item.itemId)) {
              itemSummary.set(item.itemId, {
                name: foundItem.nameAr,
                totalQuantity: 0,
                dispenseCount: 0
              });
            }
            
            const itemData = itemSummary.get(item.itemId);
            itemData.totalQuantity += item.quantity;
            itemData.dispenseCount += 1;
          });
        });
        
        reportData = Array.from(itemSummary.entries()).map(([id, data]) => ({
          itemId: id,
          name: data.name,
          totalQuantity: data.totalQuantity,
          dispenseCount: data.dispenseCount
        }));
      }

      const startY = 40;
      const rowHeight = 10;
      const margin = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const tableWidth = pageWidth - (2 * margin);
      
      let headers: string[] = [];
      let colWidths: number[] = [];
      
      if (reportType === "all") {
        headers = ["رقم المعاملة", "التاريخ", "القسم", "عدد الأصناف", "إجمالي الكميات"];
        colWidths = [40, 40, 60, 30, 30];
      } else if (reportType === "byDepartment") {
        headers = ["القسم", "عدد المعاملات", "عدد الأصناف", "إجمالي الكميات"];
        colWidths = [60, 40, 40, 40];
      } else if (reportType === "byItem") {
        headers = ["اسم الصنف", "عدد مرات الصرف", "إجمالي الكميات"];
        colWidths = [80, 40, 40];
      }
      
      let currentX = pageWidth - margin;
      
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, startY, tableWidth, rowHeight, 'F');
      
      headers.forEach((header, i) => {
        currentX -= colWidths[i];
        doc.text(header, currentX + (colWidths[i] / 2), startY + 7, { align: "center" });
      });

      let currentY = startY + rowHeight;
      
      reportData.forEach((row, index) => {
        currentX = pageWidth - margin;
        
        let rowData: string[] = [];
        
        if (reportType === "all") {
          rowData = [
            row.id,
            row.date,
            row.department,
            row.itemCount.toString(),
            row.totalQuantity.toString()
          ];
        } else if (reportType === "byDepartment") {
          rowData = [
            row.department,
            row.count.toString(),
            row.itemsCount.toString(),
            row.totalQuantity.toString()
          ];
        } else if (reportType === "byItem") {
          rowData = [
            row.name,
            row.dispenseCount.toString(),
            row.totalQuantity.toString()
          ];
        }

        doc.line(margin, currentY, pageWidth - margin, currentY);
        
        rowData.forEach((text, i) => {
          currentX -= colWidths[i];
          doc.text(text, currentX + (colWidths[i] / 2), currentY + 7, { align: "center" });
        });

        currentY += rowHeight;
        
        if (currentY > doc.internal.pageSize.getHeight() - 20 && index < reportData.length - 1) {
          doc.addPage();
          currentY = 20;
          
          doc.setFillColor(240, 240, 240);
          doc.rect(margin, currentY, tableWidth, rowHeight, 'F');
          
          currentX = pageWidth - margin;
          headers.forEach((header, i) => {
            currentX -= colWidths[i];
            doc.text(header, currentX + (colWidths[i] / 2), currentY + 7, { align: "center" });
          });
          
          currentY += rowHeight;
        }
      });

      doc.line(margin, currentY, pageWidth - margin, currentY);

      let verticalX = margin;
      for (let i = 0; i <= colWidths.length; i++) {
        doc.line(verticalX, startY, verticalX, currentY);
        verticalX += colWidths[i] || 0;
      }

      currentY += 15;
      doc.setFontSize(12);
      
      const totalTransactions = filteredTransactions.length;
      const totalItems = filteredTransactions.reduce((sum, t) => sum + t.items.length, 0);
      const totalQuantities = filteredTransactions.reduce((sum, t) => 
        sum + t.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
      
      doc.text(`إجمالي عدد المعاملات: ${totalTransactions}`, pageWidth - 30, currentY, { align: "right" });
      currentY += 10;
      doc.text(`إجمالي عدد الأصناف: ${totalItems}`, pageWidth - 30, currentY, { align: "right" });
      currentY += 10;
      doc.text(`إجمالي الكميات المصروفة: ${totalQuantities}`, pageWidth - 30, currentY, { align: "right" });

      currentY = doc.internal.pageSize.getHeight() - 30;
      
      doc.text(`تاريخ التقرير: ${format(new Date(), 'yyyy/MM/dd')}`, pageWidth - 30, currentY, { align: "right" });
      doc.text("توقيع المسؤول: ________________", 70, currentY, { align: "left" });

      let fileName = `تقرير-الصرف-المخزني`;
      if (reportPeriod === "monthly") {
        fileName += `-${format(startDate, 'yyyy-MM')}`;
      } else if (reportPeriod === "yearly") {
        fileName += `-${format(startDate, 'yyyy')}`;
      }
      if (filterDepartment !== "all") {
        fileName += `-${filterDepartment}`;
      }
      doc.save(`${fileName}.pdf`);

    } catch (error) {
      console.error('Error generating report PDF:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إنشاء ملف التقرير",
        variant: "destructive"
      });
    }
  };

  const handleSave = () => {
    dispenseItemMutation.mutate({
      items: dispenseItems.filter(item => item.itemId && item.quantity > 0),
      department: department || "",
      date
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const updateItem = (index: number, field: keyof DispenseItem, value: any) => {
    const newItems = [...dispenseItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setDispenseItems(newItems);
  };

  const handleReportPeriodChange = (period: string) => {
    setReportPeriod(period);
    
    const today = new Date();
    
    if (period === "monthly") {
      setStartDate(startOfMonth(today));
      setEndDate(endOfMonth(today));
    } else if (period === "yearly") {
      setStartDate(startOfYear(today));
      setEndDate(endOfYear(today));
    } else if (period === "custom") {
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 font-arabic">
        أمر صرف مخزني
      </h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="new">أمر صرف جديد</TabsTrigger>
          <TabsTrigger value="previous">أوامر الصرف السابقة</TabsTrigger>
          <TabsTrigger value="reports">التقارير</TabsTrigger>
        </TabsList>
        
        <TabsContent value="new">
          <Card className="max-w-4xl mx-auto p-6 bg-white">
            <div className="text-center mb-8">
              <img 
                src="/lovable-uploads/827ec35a-05da-43be-99c3-b490062605d1.png" 
                alt="شعار" 
                className="mx-auto w-40 h-auto mb-4"
              />
              <h1 className="text-2xl font-bold mb-2">طلب/أمر (صرف مخزني)</h1>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-6 text-right">
              <div>
                <Label className="font-arabic text-lg">:اليوم</Label>
                <Input className="text-right" type="text" />
              </div>
              <div>
                <Label className="font-arabic text-lg">:التاريخ</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-right",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {date ? format(date, 'yyyy/MM/dd') : "اختر التاريخ"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(date) => date && setDate(date)}
                      initialFocus
                      locale={arSA}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="font-arabic text-lg">:القسم</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون قسم</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">م</TableHead>
                    <TableHead className="text-right">الصنف</TableHead>
                    <TableHead className="text-right">الوحدة</TableHead>
                    <TableHead className="text-right">الكمية</TableHead>
                    <TableHead className="text-right">العبوة/السعة</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dispenseItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <Select value={item.itemId || "none"} onValueChange={(value) => updateItem(index, 'itemId', value === "none" ? "" : value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر الصنف" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">اختر الصنف</SelectItem>
                            {items?.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.nameAr} ({item.quantity})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={item.unit || "none"} 
                          onValueChange={(value) => updateItem(index, 'unit', value === "none" ? "" : value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="الوحدة" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">بدون وحدة</SelectItem>
                            {units.map((u) => (
                              <SelectItem key={u} value={u}>
                                {u}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity || ""}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value ? Number(e.target.value) : 0)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Input
                            value={item.capacity || ""}
                            onChange={(e) => updateItem(index, 'capacity', e.target.value)}
                            className="w-20"
                            placeholder="السعة"
                          />
                          <Select 
                            value={item.capacityUnit || "none"} 
                            onValueChange={(value) => updateItem(index, 'capacityUnit', value === "none" ? "" : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="الوحدة" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">بدون وحدة</SelectItem>
                              {capacityUnits.map((u) => (
                                <SelectItem key={u} value={u}>
                                  {u}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.notes || ""}
                          onChange={(e) => updateItem(index, 'notes', e.target.value)}
                          className="w-full"
                          placeholder="ملاحظات"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-2 gap-8 mt-8">
              <div className="text-right">
                <p className="mb-4">:المستلم</p>
                <p>:التوقيع</p>
              </div>
              <div className="text-right">
                <p className="mb-4">:أمين المخازن</p>
                <p className="mb-4">:التوقيع</p>
                <p>:المحاسب</p>
              </div>
            </div>

            <div className="flex gap-4 justify-end mt-6">
              <Button 
                variant="outline" 
                onClick={handlePrint}
                className="gap-2"
              >
                <PrinterIcon className="h-4 w-4" />
                طباعة
              </Button>
              <Button onClick={() => generatePDF()} className="gap-2">
                <FileDown className="h-4 w-4" />
                تصدير PDF
              </Button>
              <Button onClick={handleSave} className="gap-2">
                <Save className="h-4 w-4" />
                حفظ
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="previous">
          <Card className="max-w-7xl mx-auto p-6">
            <div className="space-y-6">
              <h2 className="text-xl font-bold font-arabic">أوامر الصرف السابقة</h2>
              
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم الأمر</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">القسم</TableHead>
                      <TableHead className="text-right">عدد الأصناف</TableHead>
                      <TableHead className="text-right">إجمالي الكميات</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions?.filter(t => t.type === "out").map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{transaction.id.substring(0, 8)}</TableCell>
                        <TableCell>{format(new Date(transaction.date), 'yyyy/MM/dd')}</TableCell>
                        <TableCell>{transaction.department === 'none' ? 'غير محدد' : transaction.department}</TableCell>
                        <TableCell>{transaction.items.length}</TableCell>
                        <TableCell>{transaction.items.reduce((sum, item) => sum + item.quantity, 0)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => generatePDF(transaction)}
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card className="max-w-7xl mx-auto p-6">
            <div className="space-y-6">
              <h2 className="text-xl font-bold font-arabic">تقارير الصرف المخزني</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label className="font-arabic mb-2">نوع التقرير</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر نوع التقرير" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل المعاملات</SelectItem>
                      <SelectItem value="byDepartment">حسب القسم</SelectItem>
                      <SelectItem value="byItem">حسب الصنف</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="font-arabic mb-2">الفترة</Label>
                  <Select value={reportPeriod} onValueChange={handleReportPeriodChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفترة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">شهري</SelectItem>
                      <SelectItem value="yearly">سنوي</SelectItem>
                      <SelectItem value="custom">مخصص</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="font-arabic mb-2">القسم</Label>
                  <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر القسم" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الأقسام</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {reportPeriod === "custom" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="font-arabic mb-2">من تاريخ</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-right font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {startDate ? format(startDate, 'yyyy/MM/dd') : "اختر التاريخ"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => date && setStartDate(date)}
                          initialFocus
                          locale={arSA}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label className="font-arabic mb-2">إلى تاريخ</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-right font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {endDate ? format(endDate, 'yyyy/MM/dd') : "اختر التاريخ"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={(date) => date && setEndDate(date)}
                          initialFocus
                          locale={arSA}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              <div className="flex gap-4 justify-end">
                <Button onClick={generateReportPDF} className="gap-2">
                  <FileText className="h-4 w-4" />
                  تصدير التقرير
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

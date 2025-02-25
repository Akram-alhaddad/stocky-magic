
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
  CalendarIcon, 
  Plus, 
  Trash2, 
  FileText, 
  PieChart, 
  BarChart, 
  Filter
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
      
      // Validate quantities
      for (const dispenseItem of validItems) {
        const item = await db.get("items", dispenseItem.itemId);
        if (!item) throw new Error("الصنف غير موجود");
        if (item.quantity < dispenseItem.quantity) {
          throw new Error(`الكمية غير كافية للصنف ${item.nameAr}`);
        }
      }
      
      // Update quantities
      for (const dispenseItem of validItems) {
        const item = await db.get("items", dispenseItem.itemId);
        await db.put("items", {
          ...item,
          quantity: item.quantity - dispenseItem.quantity,
          lastUpdated: new Date()
        });
      }
      
      // Add transaction
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
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      // تفعيل الكتابة من اليمين إلى اليسار
      doc.setR2L(true);
      
      // تعيين حجم الخط للعنوان
      doc.setFontSize(18);

      // تحديد البيانات التي سيتم استخدامها في الطباعة
      const printDate = transaction ? new Date(transaction.date) : date;
      const printDepartment = transaction ? transaction.department : department;
      const printItems = transaction ? transaction.items : dispenseItems;

      // إضافة العنوان
      doc.text("أمر صرف مخزني", doc.internal.pageSize.getWidth() / 2, 20, { align: "center" });

      // إضافة التاريخ والقسم
      doc.setFontSize(12);
      doc.text(`التاريخ: ${format(printDate, 'yyyy/MM/dd')}`, doc.internal.pageSize.getWidth() - 30, 35, { align: "right" });
      doc.text(`القسم: ${printDepartment === 'none' ? 'غير محدد' : printDepartment}`, doc.internal.pageSize.getWidth() - 30, 45, { align: "right" });

      // إعداد الجدول
      const startY = 60;
      const rowHeight = 10;
      const margin = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const tableWidth = pageWidth - (2 * margin);
      const colWidths = [15, 50, 30, 25, 40, 40];
      
      // إضافة رأس الجدول
      const headers = ["م", "الصنف", "الوحدة", "الكمية", "العبوة والسعة", "ملاحظات"];
      let currentX = pageWidth - margin;
      
      // خلفية رأس الجدول
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, startY, tableWidth, rowHeight, 'F');
      
      // نص رأس الجدول
      doc.setFontSize(10);
      headers.forEach((header, i) => {
        currentX -= colWidths[i];
        doc.text(header, currentX + (colWidths[i] / 2), startY + 7, { align: "center" });
      });

      // إضافة بيانات الجدول - كل الأسطر حتى الفارغة
      let currentY = startY + rowHeight;
      
      // عدد الأسطر الثابت 10 أسطر
      const displayItems = [...printItems];
      // إذا كان عدد العناصر أقل من 10، أضف عناصر فارغة
      while (displayItems.length < 10) {
        displayItems.push({ itemId: "", quantity: 0 });
      }
      
      displayItems.forEach((item, index) => {
        const foundItem = items?.find(i => i.id === item.itemId);
        currentX = pageWidth - margin;
        
        // بيانات الصف
        const rowData = [
          (index + 1).toString(),
          foundItem?.nameAr || "-",
          item.unit || "-",
          item.quantity ? item.quantity.toString() : "-",
          `${item.capacity || ""} ${item.capacityUnit || ""}`.trim() || "-",
          item.notes || "-"
        ];

        // رسم خط أفقي
        doc.line(margin, currentY, pageWidth - margin, currentY);
        
        // كتابة البيانات
        rowData.forEach((text, i) => {
          currentX -= colWidths[i];
          doc.text(text, currentX + (colWidths[i] / 2), currentY + 7, { align: "center" });
        });

        currentY += rowHeight;
      });

      // رسم خط أفقي نهائي
      doc.line(margin, currentY, pageWidth - margin, currentY);

      // رسم الخطوط العمودية
      let verticalX = margin;
      for (let i = 0; i <= colWidths.length; i++) {
        doc.line(verticalX, startY, verticalX, currentY);
        verticalX += colWidths[i] || 0;
      }

      // إضافة التوقيعات
      currentY += 20;
      doc.setFontSize(12);
      doc.text("التوقيعات:", pageWidth / 2, currentY, { align: "center" });
      currentY += 15;
      
      doc.text("المستلم: ________________", pageWidth - 50, currentY, { align: "right" });
      doc.text("أمين المخزن: ________________", 50, currentY, { align: "left" });

      // حفظ الملف
      const fileName = transaction 
        ? `أمر-صرف-${transaction.id.substring(0, 8)}.pdf` 
        : `أمر-صرف-${format(printDate, 'yyyy-MM-dd')}.pdf`;
      
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

      // تفعيل الكتابة من اليمين إلى اليسار
      doc.setR2L(true);
      
      // تعيين حجم الخط للعنوان
      doc.setFontSize(18);

      // تصفية المعاملات حسب المعايير المختارة
      let filteredTransactions = transactions?.filter(t => t.type === "out") || [];
      
      // تصفية حسب القسم
      if (filterDepartment !== "all") {
        filteredTransactions = filteredTransactions.filter(t => t.department === filterDepartment);
      }

      // تصفية حسب التاريخ
      filteredTransactions = filteredTransactions.filter(t => {
        const transactionDate = new Date(t.date);
        return isWithinInterval(transactionDate, { start: startDate, end: endDate });
      });

      // تحديد عنوان التقرير
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

      // إضافة العنوان
      doc.text(reportTitle, doc.internal.pageSize.getWidth() / 2, 20, { align: "center" });

      // إذا لم تكن هناك معاملات
      if (filteredTransactions.length === 0) {
        doc.setFontSize(14);
        doc.text("لا توجد بيانات للعرض في هذه الفترة", doc.internal.pageSize.getWidth() / 2, 50, { align: "center" });
        doc.save(`تقرير-الصرف-المخزني.pdf`);
        return;
      }

      // تجميع البيانات حسب نوع التقرير
      let reportData: any[] = [];
      
      if (reportType === "all") {
        // تقرير كل المعاملات
        reportData = filteredTransactions.map(t => ({
          id: t.id.substring(0, 8),
          date: format(new Date(t.date), 'yyyy/MM/dd'),
          department: t.department === 'none' ? 'غير محدد' : t.department,
          itemCount: t.items.length,
          totalQuantity: t.items.reduce((sum, item) => sum + item.quantity, 0)
        }));
      } else if (reportType === "byDepartment") {
        // تقرير حسب القسم
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
        // تقرير حسب الصنف
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

      // إعداد الجدول
      const startY = 40;
      const rowHeight = 10;
      const margin = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const tableWidth = pageWidth - (2 * margin);
      
      // تحديد العناوين وأعرض الأعمدة حسب نوع التقرير
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
      
      // رسم رأس الجدول
      let currentX = pageWidth - margin;
      
      // خلفية رأس الجدول
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, startY, tableWidth, rowHeight, 'F');
      
      // نص رأس الجدول
      doc.setFontSize(10);
      headers.forEach((header, i) => {
        currentX -= colWidths[i];
        doc.text(header, currentX + (colWidths[i] / 2), startY + 7, { align: "center" });
      });

      // إضافة بيانات الجدول
      let currentY = startY + rowHeight;
      
      reportData.forEach((row, index) => {
        currentX = pageWidth - margin;
        
        // تحديد بيانات الصف حسب نوع التقرير
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

        // رسم خط أفقي
        doc.line(margin, currentY, pageWidth - margin, currentY);
        
        // كتابة البيانات
        rowData.forEach((text, i) => {
          currentX -= colWidths[i];
          doc.text(text, currentX + (colWidths[i] / 2), currentY + 7, { align: "center" });
        });

        currentY += rowHeight;
        
        // التحقق من انتهاء الصفحة وإضافة صفحة جديدة إذا لزم الأمر
        if (currentY > doc.internal.pageSize.getHeight() - 20 && index < reportData.length - 1) {
          doc.addPage();
          currentY = 20;
          
          // إعادة رسم رأس الجدول في الصفحة الجديدة
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

      // رسم خط أفقي نهائي
      doc.line(margin, currentY, pageWidth - margin, currentY);

      // رسم الخطوط العمودية
      let verticalX = margin;
      for (let i = 0; i <= colWidths.length; i++) {
        doc.line(verticalX, startY, verticalX, currentY);
        verticalX += colWidths[i] || 0;
      }

      // إضافة معلومات إضافية
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

      // إضافة التاريخ والتوقيع
      currentY = doc.internal.pageSize.getHeight() - 30;
      
      doc.text(`تاريخ التقرير: ${format(new Date(), 'yyyy/MM/dd')}`, pageWidth - 30, currentY, { align: "right" });
      doc.text("توقيع المسؤول: ________________", 70, currentY, { align: "left" });

      // حفظ الملف
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
      // تحتفظ بالتواريخ الحالية للفترة المخصصة
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
          <Card className="max-w-7xl mx-auto p-6">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label className="font-arabic mb-2">القسم</Label>
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

                <div className="flex-1">
                  <Label className="font-arabic mb-2">التاريخ</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-right font-normal",
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
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">م</TableHead>
                      <TableHead className="text-right">الصنف</TableHead>
                      <TableHead className="text-right">الوحدة</TableHead>
                      <TableHead className="text-right">الكمية</TableHead>
                      <TableHead className="text-right">العبوة والسعة</TableHead>
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
                              <SelectValue placeholder="اختر الوحدة" />
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
                                <SelectItem value="none
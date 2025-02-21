import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDB, departments, units, capacityUnits } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
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
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { PrinterIcon, FileDown, Save, CalendarIcon, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DispenseItem {
  itemId: string;
  quantity: number;
  unit?: string;
  capacity?: number;
  capacityUnit?: string;
  notes?: string;
}

export default function Dispense() {
  const [date, setDate] = useState<Date>(new Date());
  const [department, setDepartment] = useState("none");
  const [dispenseItems, setDispenseItems] = useState<DispenseItem[]>(
    Array(10).fill({ itemId: "", quantity: 0 })
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const db = await getDB();
      return db.getAll("items");
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

  const generatePDF = async () => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      // إعداد دعم اللغة العربية
      doc.setR2L(true);
      doc.setLanguage("ar");
      
      // تعيين الخط والحجم
      doc.setFont("helvetica", "normal", "normal");
      doc.setFontSize(16);

      // إضافة العنوان
      doc.text("أمر صرف مخزني", doc.internal.pageSize.getWidth() / 2, 20, { align: "center" });

      // إضافة التاريخ والقسم
      doc.setFontSize(12);
      doc.text(`الت��ريخ: ${format(date, 'yyyy/MM/dd')}`, doc.internal.pageSize.getWidth() - 30, 35, { align: "right" });
      doc.text(`القسم: ${department === 'none' ? 'غير محدد' : department}`, doc.internal.pageSize.getWidth() - 30, 45, { align: "right" });

      // إعداد الجدول
      const startY = 60;
      const rowHeight = 12;
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
      doc.setFont("helvetica", "bold");
      headers.forEach((header, i) => {
        currentX -= colWidths[i];
        doc.text(header, currentX + (colWidths[i] / 2), startY + 8, { align: "center" });
      });

      // إضافة بيانات الجدول
      doc.setFont("helvetica", "normal");
      let currentY = startY + rowHeight;
      const validItems = dispenseItems.filter(item => item.itemId && item.quantity > 0);
      
      validItems.forEach((item, index) => {
        const foundItem = items?.find(i => i.id === item.itemId);
        if (!foundItem) return;
        
        currentX = pageWidth - margin;
        
        // بيانات الصف
        const rowData = [
          (index + 1).toString(),
          foundItem.nameAr,
          item.unit || "-",
          item.quantity.toString(),
          `${item.capacity || ""} ${item.capacityUnit || ""}`.trim() || "-",
          item.notes || "-"
        ];

        // رسم خط أفقي
        doc.line(margin, currentY, pageWidth - margin, currentY);
        
        // كتابة البيانات
        rowData.forEach((text, i) => {
          currentX -= colWidths[i];
          doc.text(text, currentX + (colWidths[i] / 2), currentY + 8, { align: "center" });
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
      doc.text("التوقيعات:", pageWidth / 2, currentY, { align: "center" });
      currentY += 15;
      
      doc.text("المستلم: ________________", pageWidth - 50, currentY, { align: "right" });
      doc.text("أمين المخزن: ________________", 50, currentY, { align: "left" });

      // حفظ الملف
      doc.save(`أمر-صرف-${format(date, 'yyyy-MM-dd')}.pdf`);

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إنشاء ملف PDF",
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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 font-arabic">
        أمر صرف مخزني
      </h1>
      
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
                        placeholder="ملاحظات"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-4 pt-4">
            <Button onClick={handleSave} className="flex-1">
              <Save className="ml-2 h-4 w-4" />
              حفظ
            </Button>
            <Button onClick={handlePrint} variant="outline" className="flex-1">
              <PrinterIcon className="ml-2 h-4 w-4" />
              طباعة
            </Button>
            <Button
              onClick={generatePDF}
              variant="outline"
              className="flex-1"
            >
              <FileDown className="ml-2 h-4 w-4" />
              تصدير PDF
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

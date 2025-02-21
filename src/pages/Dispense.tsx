
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
  const [department, setDepartment] = useState("");
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
      // استخدام المكتبة مع الإعدادات الصحيحة للغة العربية
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // إعداد خصائص الوثيقة
      doc.setR2L(true);
      doc.setLanguage("ar");

      // تحديد نمط الخط والحجم
      doc.setFont("helvetica");
      doc.setFontSize(14);

      // كتابة العنوان
      doc.text("أمر صرف مخزني", 150, 20);

      // معلومات الرأس
      doc.setFontSize(12);
      const today = new Date();
      doc.text(`التاريخ: ${format(date, 'yyyy/MM/dd')}`, 250, 30);
      doc.text(`القسم: ${department || 'غير محدد'}`, 250, 40);

      // رسم الجدول
      const startY = 50;
      const cellHeight = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const colWidth = pageWidth / 6;

      // عناوين الأعمدة
      doc.setFillColor(240, 240, 240);
      doc.rect(10, startY, pageWidth - 20, cellHeight, 'F');
      
      const headers = ["م", "الصنف", "الوحدة", "الكمية", "العبوة والسعة", "ملاحظات"];
      headers.forEach((header, i) => {
        doc.text(header, pageWidth - (i * colWidth) - 15, startY + 7);
      });

      // بيانات الجدول
      let currentY = startY + cellHeight;
      const validItems = dispenseItems.filter(item => item.itemId && item.quantity > 0);
      
      validItems.forEach((item, index) => {
        const foundItem = items?.find(i => i.id === item.itemId);
        if (!foundItem) return;

        const rowData = [
          (index + 1).toString(),
          foundItem.nameAr,
          item.unit || "",
          item.quantity.toString(),
          `${item.capacity || ""} ${item.capacityUnit || ""}`,
          item.notes || ""
        ];

        rowData.forEach((text, i) => {
          doc.text(text, pageWidth - (i * colWidth) - 15, currentY + 7);
        });

        // رسم خطوط الخلايا
        doc.rect(10, currentY, pageWidth - 20, cellHeight);
        currentY += cellHeight;
      });

      // التوقيعات
      currentY += 20;
      doc.text("التوقيعات:", 150, currentY);
      currentY += 10;
      doc.text("المستلم: ________________", 250, currentY);
      doc.text("أمين المخزن: ________________", 100, currentY);

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
                      <Select value={item.itemId} onValueChange={(value) => updateItem(index, 'itemId', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الصنف" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">بدون صنف</SelectItem>
                          {items?.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.nameAr} ({item.quantity})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={item.unit || ""} onValueChange={(value) => updateItem(index, 'unit', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الوحدة" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">بدون وحدة</SelectItem>
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
                        <Select value={item.capacityUnit || ""} onValueChange={(value) => updateItem(index, 'capacityUnit', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="الوحدة" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">بدون وحدة</SelectItem>
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

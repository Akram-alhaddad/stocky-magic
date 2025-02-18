import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDB, departments, units, capacityUnits } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [dispenseItems, setDispenseItems] = useState<DispenseItem[]>([
    { itemId: "none", quantity: 0 }
  ]);
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
      
      // Validate quantities
      for (const dispenseItem of items) {
        const item = await db.get("items", dispenseItem.itemId);
        if (!item) throw new Error("الصنف غير موجود");
        if (item.quantity < dispenseItem.quantity) {
          throw new Error(`الكمية غير كافية للصنف ${item.nameAr}`);
        }
      }
      
      // Update quantities
      for (const dispenseItem of items) {
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
        items,
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
    const doc = new jsPDF();
    doc.addFont("public/fonts/NotoNaskhArabic-Regular.ttf", "NotoNaskhArabic", "normal");
    doc.setFont("NotoNaskhArabic");
    
    // العنوان
    doc.setFontSize(24);
    doc.text("أمر صرف مخزني", 105, 20, { align: "center" });
    
    // المعلومات الأساسية
    doc.setFontSize(14);
    doc.text(`التاريخ: ${format(date, 'yyyy/MM/dd')}`, 190, 40, { align: "right" });
    doc.text(`القسم: ${department || "بدون قسم"}`, 190, 50, { align: "right" });
    doc.text(`اليوم: ${format(date, 'EEEE', { locale: arSA })}`, 190, 60, { align: "right" });
    
    // تفاصيل الأصناف
    let yPos = 80;
    doc.text("الأصناف:", 190, yPos, { align: "right" });
    yPos += 10;

    dispenseItems.forEach((dispenseItem, index) => {
      const item = items?.find(i => i.id === dispenseItem.itemId);
      if (!item) return;

      doc.text(`${index + 1}. ${item.nameAr}`, 180, yPos, { align: "right" });
      yPos += 8;

      if (dispenseItem.quantity || dispenseItem.unit) {
        doc.text(`الكمية: ${dispenseItem.quantity || ""} ${dispenseItem.unit || ""}`, 170, yPos, { align: "right" });
        yPos += 8;
      }

      if (dispenseItem.capacity || dispenseItem.capacityUnit) {
        doc.text(`السعة: ${dispenseItem.capacity || ""} ${dispenseItem.capacityUnit || ""}`, 170, yPos, { align: "right" });
        yPos += 8;
      }

      if (dispenseItem.notes) {
        doc.text(`ملاحظات: ${dispenseItem.notes}`, 170, yPos, { align: "right" });
        yPos += 8;
      }

      yPos += 5;
    });
    
    // التوقيعات
    yPos = 250;
    
    // المستلم
    doc.text("المستلم:", 170, yPos, { align: "right" });
    doc.text("التوقيع:", 170, yPos + 20, { align: "right" });
    
    // أمين المخزن
    doc.text("أمين المخزن:", 60, yPos, { align: "left" });
    doc.text("التوقيع:", 60, yPos + 20, { align: "left" });
    
    // خطوط التوقيع
    doc.setDrawColor(0);
    doc.line(120, yPos + 20, 170, yPos + 20); // خط توقيع المستلم
    doc.line(20, yPos + 20, 70, yPos + 20);   // خط توقيع أمين المخزن
  
    doc.save(`امر-صرف-${format(date, 'yyyy-MM-dd')}.pdf`);
  };

  const handleSave = () => {
    // إزالة التحقق من الحقول المطلوبة
    dispenseItemMutation.mutate({
      items: dispenseItems,
      department: department || "", // السماح بقيمة فارغة
      date
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const addItem = () => {
    setDispenseItems([...dispenseItems, { itemId: "", quantity: 0 }]);
  };

  const removeItem = (index: number) => {
    if (dispenseItems.length > 1) {
      setDispenseItems(dispenseItems.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof DispenseItem, value: any) => {
    const newItems = [...dispenseItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setDispenseItems(newItems);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 font-arabic">
        أمر/طلب (صرف مخزني)
      </h1>
      
      <Card className="max-w-4xl mx-auto p-6">
        <div className="space-y-4">
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

          <div className="space-y-4">
            {dispenseItems.map((item, index) => (
              <Card key={index} className="p-4">
                <div className="grid gap-4">
                  <div className="flex gap-4 items-start">
                    <div className="flex-1">
                      <Label className="font-arabic mb-2">الصنف</Label>
                      <Select value={item.itemId} onValueChange={(value) => updateItem(index, 'itemId', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الصنف" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">بدون صنف</SelectItem>
                          {items?.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.nameAr} ({item.quantity})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1">
                      <Label className="font-arabic mb-2">الكمية</Label>
                      <Input
                        type="number"
                        value={item.quantity || ""}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>

                    <div className="flex-1">
                      <Label className="font-arabic mb-2">الوحدة</Label>
                      <Select value={item.unit || "none"} onValueChange={(value) => updateItem(index, 'unit', value === "none" ? undefined : value)}>
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
                    </div>

                    <Button
                      variant="destructive"
                      size="icon"
                      className="mt-8"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="font-arabic mb-2">السعة</Label>
                      <Input
                        value={item.capacity || ""}
                        onChange={(e) => updateItem(index, 'capacity', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="font-arabic mb-2">وحدة السعة</Label>
                      <Select value={item.capacityUnit || "none"} onValueChange={(value) => updateItem(index, 'capacityUnit', value === "none" ? undefined : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر وحدة السعة" />
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
                  </div>

                  <div>
                    <Label className="font-arabic mb-2">ملاحظات</Label>
                    <Textarea
                      value={item.notes || ""}
                      onChange={(e) => updateItem(index, 'notes', e.target.value)}
                      placeholder="أدخل الملاحظات هنا"
                      className="font-arabic"
                    />
                  </div>
                </div>
              </Card>
            ))}

            <Button onClick={addItem} variant="outline" className="w-full">
              <Plus className="ml-2 h-4 w-4" />
              إضافة صنف
            </Button>
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

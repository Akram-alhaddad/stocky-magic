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
    try {
      // Create new document with RTL support
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
        putOnlyUsedFonts: true,
        floatPrecision: 16
      });

      // Set default font
      doc.setFont("Helvetica", "normal");
      
      // Set font sizes
      doc.setFontSize(16);
      
      // Header
      doc.text("Order Form", 105, 20, { align: "center" });
      doc.text("أمر صرف", 105, 30, { align: "center" });
      
      // Basic information
      doc.setFontSize(12);
      doc.text([
        `Date: ${format(date, 'yyyy/MM/dd')}`,
        `Department: ${department === "none" ? "None" : department}`,
        `Day: ${format(date, 'EEEE', { locale: arSA })}`
      ], 20, 45);

      // Items header
      let yPos = 70;
      doc.text("Items / الأصناف", 20, yPos);
      yPos += 10;

      // Items list
      dispenseItems.forEach((dispenseItem, index) => {
        if (dispenseItem.itemId === "none") return;
        
        const item = items?.find(i => i.id === dispenseItem.itemId);
        if (!item) return;

        // Item information
        doc.text(`${index + 1}. Item:`, 20, yPos);
        doc.text(item.nameAr, 50, yPos);
        yPos += 7;

        // Quantity
        if (dispenseItem.quantity || dispenseItem.unit) {
          doc.text(`Quantity:`, 25, yPos);
          doc.text(`${dispenseItem.quantity || ""} ${dispenseItem.unit === "none" ? "" : (dispenseItem.unit || "")}`, 50, yPos);
          yPos += 7;
        }

        // Capacity
        if (dispenseItem.capacity || dispenseItem.capacityUnit) {
          doc.text(`Capacity:`, 25, yPos);
          doc.text(`${dispenseItem.capacity || ""} ${dispenseItem.capacityUnit === "none" ? "" : (dispenseItem.capacityUnit || "")}`, 50, yPos);
          yPos += 7;
        }

        // Notes
        if (dispenseItem.notes) {
          doc.text(`Notes:`, 25, yPos);
          doc.text(dispenseItem.notes, 50, yPos);
          yPos += 7;
        }

        yPos += 5; // Extra space between items
      });

      // Signatures section
      yPos = Math.max(yPos + 20, 220);
      doc.text("Signatures / التوقيعات", 105, yPos, { align: "center" });
      yPos += 20;

      // Receiver signature
      doc.text("Receiver / المستلم:", 30, yPos);
      doc.text("___________________", 30, yPos + 10);

      // Warehouse keeper signature
      doc.text("Warehouse Keeper / أمين المخزن:", 120, yPos);
      doc.text("___________________", 120, yPos + 10);

      // Date at bottom
      doc.text(`Report Date: ${format(date, 'yyyy/MM/dd')}`, 105, yPos + 30, { align: "center" });

      // Save file
      doc.save(`order-form-${format(date, 'yyyy-MM-dd')}.pdf`);

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
        Order Form / أمر صرف
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

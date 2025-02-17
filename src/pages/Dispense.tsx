
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDB, departments, units, capacityUnits } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { PrinterIcon, FileDown, Save } from "lucide-react";

export default function Dispense() {
  const [language, setLanguage] = useState<"en" | "ar">("ar");
  const [selectedItem, setSelectedItem] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [department, setDepartment] = useState("");
  const [unit, setUnit] = useState("");
  const [capacity, setCapacity] = useState("");
  const [capacityUnit, setCapacityUnit] = useState("");
  const [notes, setNotes] = useState("");
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
    mutationFn: async ({ itemId, quantity, department }: { itemId: string; quantity: number; department: string }) => {
      const db = await getDB();
      const item = await db.get("items", itemId);
      
      if (!item) throw new Error("Item not found");
      if (item.quantity < quantity) throw new Error("Insufficient quantity");
      
      // Update item quantity
      await db.put("items", {
        ...item,
        quantity: item.quantity - quantity,
        lastUpdated: new Date()
      });
      
      // Add transaction
      const transactionId = crypto.randomUUID();
      await db.add("transactions", {
        id: transactionId,
        itemId,
        quantity,
        type: "out",
        department,
        unit,
        capacity: Number(capacity),
        capacityUnit,
        notes,
        date: new Date()
      });
      
      return { item, transactionId };
    },
    onSuccess: ({ item, transactionId }) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast({
        title: language === "ar" ? "تم بنجاح" : "Success",
        description: language === "ar"
          ? "تم صرف المخزون بنجاح"
          : "Item dispensed successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const generatePDF = (item: any) => {
    const doc = new jsPDF();
    
    // Add header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("أمر صرف مخزني", 105, 20, { align: "center" });
    
    // Add content
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    
    const content = [
      [`التاريخ: ${new Date().toLocaleDateString('ar-SA')}`],
      [`القسم: ${department}`],
      [`الصنف: ${item.nameAr}`],
      [`الكمية: ${quantity}`],
      [`الوحدة: ${unit}`],
      capacity && [`السعة: ${capacity} ${capacityUnit}`],
      notes && [`ملاحظات: ${notes}`]
    ].filter(Boolean);
    
    let yPos = 40;
    content.forEach(line => {
      doc.text(line[0], 20, yPos);
      yPos += 10;
    });
    
    // Save PDF
    doc.save(`امر-صرف-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleSave = () => {
    if (!selectedItem || !quantity || !department) {
      toast({
        title: "خطأ",
        description: "الرجاء ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }
    
    dispenseItemMutation.mutate({
      itemId: selectedItem,
      quantity,
      department
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedItemData = items?.find(item => item.id === selectedItem);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 font-arabic">
        أمر/طلب (صرف مخزني)
      </h1>
      
      <Card className="max-w-2xl mx-auto p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-arabic">القسم</Label>
            <Select onValueChange={setDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="اختر القسم" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-arabic">الصنف</Label>
            <Select onValueChange={setSelectedItem}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الصنف" />
              </SelectTrigger>
              <SelectContent>
                {items?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nameAr} ({item.quantity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-arabic">الكمية</Label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label className="font-arabic">الوحدة</Label>
            <Select onValueChange={setUnit}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الوحدة" />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-arabic">السعة</Label>
              <Input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-arabic">وحدة السعة</Label>
              <Select onValueChange={setCapacityUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر وحدة السعة" />
                </SelectTrigger>
                <SelectContent>
                  {capacityUnits.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-arabic">ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أدخل الملاحظات هنا"
              className="font-arabic"
            />
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
              onClick={() => selectedItemData && generatePDF(selectedItemData)}
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


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ItemFormProps {
  onSubmit: (item: {
    name: string;
    nameAr: string;
    quantity: number;
    minQuantity: number;
    category: string;
  }) => void;
  initialData?: {
    name: string;
    nameAr: string;
    quantity: number;
    minQuantity: number;
    category: string;
  };
  language: "en" | "ar";
}

export default function ItemForm({ onSubmit, initialData, language }: ItemFormProps) {
  const [formData, setFormData] = useState(initialData || {
    name: "",
    nameAr: "",
    quantity: 0,
    minQuantity: 0,
    category: ""
  });
  
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.nameAr || !formData.category) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" 
          ? "الرجاء ملء جميع الحقول المطلوبة"
          : "Please fill all required fields",
        variant: "destructive"
      });
      return;
    }
    
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">
            {language === "ar" ? "اسم الصنف (إنجليزي)" : "Item Name (English)"}
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="nameAr">
            {language === "ar" ? "اسم الصنف (عربي)" : "Item Name (Arabic)"}
          </Label>
          <Input
            id="nameAr"
            value={formData.nameAr}
            onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
            className="font-arabic"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantity">
            {language === "ar" ? "الكمية" : "Quantity"}
          </Label>
          <Input
            id="quantity"
            type="number"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="minQuantity">
            {language === "ar" ? "الحد الأدنى" : "Minimum Quantity"}
          </Label>
          <Input
            id="minQuantity"
            type="number"
            value={formData.minQuantity}
            onChange={(e) => setFormData({ ...formData, minQuantity: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">
          {language === "ar" ? "الفئة" : "Category"}
        </Label>
        <Input
          id="category"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
        />
      </div>

      <Button type="submit" className="w-full">
        {language === "ar" ? "حفظ" : "Save"}
      </Button>
    </form>
  );
}

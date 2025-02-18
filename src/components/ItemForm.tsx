
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ItemFormProps {
  onSubmit: (item: {
    nameAr: string;
    quantity: number;
    minQuantity: number;
    category: string;
  }) => void;
  initialData?: {
    nameAr: string;
    quantity: number;
    minQuantity: number;
    category: string;
  };
}

export default function ItemForm({ onSubmit, initialData }: ItemFormProps) {
  const [formData, setFormData] = useState(initialData || {
    nameAr: "",
    quantity: 0,
    minQuantity: 0,
    category: ""
  });
  
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nameAr || !formData.category) {
      toast({
        title: "خطأ",
        description: "الرجاء ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }
    
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nameAr">
          اسم الصنف
        </Label>
        <Input
          id="nameAr"
          value={formData.nameAr}
          onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
          className="font-arabic"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantity">
            الكمية
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
            الحد الأدنى
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
          الفئة
        </Label>
        <Input
          id="category"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
        />
      </div>

      <Button type="submit" className="w-full">
        حفظ
      </Button>
    </form>
  );
}

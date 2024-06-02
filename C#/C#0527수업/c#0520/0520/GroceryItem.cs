using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace _0520
{
    public class GroceryItem : Item
    {
        public DateTime ExpirationDate { get; set; }

        public GroceryItem(string description, decimal price, string sku, DateTime expirationDate)
            : base(0, description, price )
        {
           
            ExpirationDate = expirationDate;
            Sku = sku;
        }

        public override decimal CalculateTotalPrice(int quantity)
        {
            // GroceryItem의 가격은 수량에 관계없이 일정하므로 간단히 Price * Quantity를 반환합니다.
            return Price * quantity;
        }
    }
}

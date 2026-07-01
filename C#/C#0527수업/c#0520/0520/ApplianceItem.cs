using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace _0520
{
    public class ApplianceItem : Item
    {
        public ApplianceType Type { get; set; }

        public ApplianceItem(string description, decimal price, string sku, ApplianceType type)
            : base(0,description, price)
        {
            Type = type;
        }

        public override decimal CalculateTotalPrice(int quantity)
        {
            // 가전제품의 가격은 수량에 관계없이 일정하므로 간단히 Price * Quantity를 반환합니다.
            return Price * quantity;
        }
    }

    public enum ApplianceType
    {
        Washer,
        Dryer,
        Dishwasher,
        Oven,
        Refrigerator
    }

}

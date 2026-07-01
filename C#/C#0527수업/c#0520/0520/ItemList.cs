using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace _0520
{
    public class ItemList
    {
        public List<Item> Items { get; set; }
        public decimal TotalPrice { get; private set; }

        public ItemList()
        {
            Items = new List<Item>();
            TotalPrice = 0;
        }

        public void AddItem(Item item)
        {
            Items.Add(item);
            TotalPrice += item.Price;
        }

        public void RemoveItem(Item item)
        {
            Items.Remove(item);
            TotalPrice -= item.Price;
        }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace _0520
{
    public abstract class Item
    {

        public int Id { get; set; }
        public string Name { get; set; }
        public decimal Price { get; set; }

        public Item(int id, string name, decimal price)
        {
            Id = id;
            Name = name;
            Price = price;
        }

        public abstract decimal CalculateTotalPrice(int quantity);

    }
}

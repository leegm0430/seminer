using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace _0520
{
    class Vendor : IPayable
    {
        public int Id { get; }
        public decimal Totallnvoices { get; }

        public Vendor(int id, decimal totallnvoices)
        {
            Id = id;
            Totallnvoices = totallnvoices;
        }
        public decimal CalculatePay()
        {
            return Totallnvoices;
        }
    }
}

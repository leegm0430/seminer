using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace _0520
{
    internal class Employee : IPayable
    {
        public int Id { get; }
        public  Employee(int id)
        {
            Id = id;
        }

        public virtual decimal CalculatePay()
        {
            return 0m;
        }
    }
}

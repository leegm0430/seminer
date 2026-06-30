using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace _0520
{
    interface IPayable
    {
        int Id { get; }
        decimal CalculatePay();
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using static System.Console;
namespace ConsoleApp1
{
    internal class Program
    {
        static void Main(string[] args)
        {
            /* int i = 0;            //값 형(value Type)
             string s = null;     
             s = "안녕하세요";
             string empty = "";

             WriteLine(i);
             WriteLine(s);
             WriteLine(empty);*/
            /*
                        //참조 형식 null 할당 가능
                        string s = null; Console.WriteLine(s);

                        //값 형식 : null 할당 불가능 -> 에러
                        //int i = null; Console.WriteLine(i)l;
                        int? i = null; Console.WriteLine(i);
                        double? d = null; Console.WriteLine(d);

                        Nullable<int> ii = null; Console.WriteLine(ii); 
                        Nullable<double> dd = null;  Console.WriteLine(dd);*/

            /*string nullValue = null;
            string message = "";

            //[1] if 구문으로 null 값 비교
            nullValue = null;
            if(nullValue == null) 
            {
                message = "[1] null이면 새로운 값으로 초기화합니다.";
            }
            Console.WriteLine(message);

            nullValue = null;
            message = nullValue ?? "[2] null이면 새로운 값으로 초기화합니다.";
            Console.WriteLine(message);*/

            /* var result = "";
             var message = "";

             message = null;
             result = message ?? "기본 값";
             Console.WriteLine(result); // 기본 값

             message = "있는 값";
             result = message ?? "기본 값";
             Console.WriteLine(result); // 있는 값
 */
            int? Value = null;
            int defaultValue = Value ??  -1;
            Console.WriteLine(defaultValue);
        }
    }
}

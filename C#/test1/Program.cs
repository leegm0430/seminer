using System;
using System.ComponentModel;
/*class SharedAndInstance
{
    public static void AMethod() => Console.WriteLine("[1] AAA");
    public void BMethod() => Console.WriteLine("[2] BBB");
}

class StaticAndInstance
{
    static void Main()
    {
        SharedAndInstance sharedAndInstance = new SharedAndInstance();

        SharedAndInstance.AMethod();  // (1) 올바름 AMethod는 static 메서드이기 때문에 클래스 이름으로 호출 가능
       // SharedAndInstance.BMethod();  // (2) 오류 발생 BMethod는 인스턴스 메서드인데 클래스 이름을 통해 호출하려고 했다. 인스턴스 메서드는 클래스의 인스턴스를 통해서만 호출 할 수 있다.
       // sharedAndInstance.AMethod();  // (3) 오류 발생 AMethod는 static메서드인데 인스턴스를 통해 호출하려고 했기 때문에 오류가 발생했다. static 메서드는 클래스 이름을 통해 호출 해야한다. 
        sharedAndInstance.BMethod();  // (4) 올바름  BMethod는 인스턴스 메서드이기 때문에 인스턴스를 통해 호출 해야한다.(sharedAndInstance)
        
    }
}*/


/*
class ConstructorLog
{
    private static int count = 0; // 생성자 호출 횟수 추적용 정적 필드

    public ConstructorLog()
    {
        Console.WriteLine($"{count} 번째 기본 생성자 실행");
        count++;
    }

    public ConstructorLog(string message)
    {
        Console.WriteLine($"{count} 번째 생성자 실행 : {message}");
        count++;
    }
}

class ConstructorOverload
{
    static void Main()
    {
        ConstructorLog log1 = new ConstructorLog();         // 0 번째 기본 생성자 실행
        ConstructorLog log2 = new ConstructorLog("C#");     // 1 번째 생성자 실행 : C#
        ConstructorLog log3 = new ConstructorLog("ASP.NET");// 2 번째 생성자 실행 : ASP.NET
    }
}
*/
/*class Say
{
    private string message = "안녕하세요.";

    public Say() => Console.WriteLine(this.message);

    public Say(string message) : this()
    {
        this.message = message;
        Console.WriteLine(this.message);
    }
}

class Program
{
    static void Main() => new Say("잘가요.");

}*/
/*기본 생성자 Say()가 호출되어 this.message 값을 출력합니다. 이때 this.message의 초기값은 "안녕하세요."입니다.
따라서, 첫 번째 출력은 "안녕하세요."입니다.
이후 Say(string message) 생성자의 본문이 실행되어 this.message가 "잘가요."로 변경되고, 이 값을 출력합니다.
따라서, 두 번째 출력은 "잘가요."입니다.*/

/*class Say
{
    private string message = "안녕하세요.";

    public Say()
    {
        Console.WriteLine("부모 :" + this.message);
    }

    public Say(string message) :this()
    {
        Console.WriteLine(message);
    }
}

class Tell : Say
{
    private string childMessage = "헬로우";

    public Tell(string message) : base()
    {
        Console.WriteLine("자식:" + childMessage);
        Console.WriteLine(message);
    }

    public Tell(string message1, string message2) : base()
    {
        Console.WriteLine("자식:" + childMessage);
        Console.WriteLine(message1+ " "+ message2);
    }
}
class Program
{ 
    static void Main()
    {
        new Say("==> 다음에");
        new Tell("==> 잘가요");
        new Tell("==> 안녕", "굿바이 ");
    }
}*/
/*class Parent
{
    public virtual void Work() => Console.WriteLine("프로그래머");
}

class Child : Parent
{
    public override void Work()
    {
        Console.WriteLine("프로게이머");
    }
}
class GrandChild : Parent
{
    public override void Work() => Console.WriteLine("핵커");
}

class VirtualOverride
{
    static void Main()
    {
        new Parent().Work();
        new Child().Work();
        new GrandChild().Work();
    }
}*/

/*class Parent
{
    public virtual void Work() => Console.WriteLine("프로그래머");
}

class Child : Parent
{
    //public override void Work() => Console.WriteLine("프로게이머");
   
}
class GrandChild : Parent
{
    //public override void Work() => Console.WriteLine("핵커");
}

class VirtualOverride
{
    static void Main()
    {
        new Parent().Work();
        new Child().Work();
        new GrandChild().Work();
    }
}*/

/*class Student
{
    public string Name { get; set; }
    public string Addr { get; set; }

    public override string ToString()
    {
        return ($"[이름 : {Name} 주소: {Addr}]");
    }
}

class Program
{
    static void Main()
    {
        Student student1 = new Student { Name = "홍길동", Addr = "서울" };
        Student student2 = new Student { Name = "김길자", Addr = "인천" };
        Console.WriteLine(student1);
        Console.WriteLine(student2);
    }
}
*/

/*public interface ISomeThings
{
    void Method1();
    void Method2(string str);
}

class SomeThing : ISomeThings
{
    public void Method1()
    {
        Console.WriteLine("임의의 물품 출력");
    }

    public void Method2(string str)
    {
        Console.WriteLine(str + " 물품 출력");
    }
}

class Program
{ 
    static void Main()
    {
        SomeThing something1 = new SomeThing();
        SomeThing something2 = new SomeThing();
        SomeThing something3 = new SomeThing();

        something1.Method1();
        something2.Method2("홍길동");
        something3.Method2("김길자");
    }
}*/

/*interface IAnimal
{
    void Eat();
}

interface IDog
{
    void Yelp();
}

class Dog : IAnimal , IDog
{
    public void Eat()
    {
        Console.WriteLine("개가 먹는다.");
    }
    public void Yelp() 
    {
        Console.WriteLine("개가 짖는다.");
    }
}

class Program
{
    static void Main()
    {
        Dog dog1 = new Dog();
        Dog dog2 = new Dog();

        dog1.Eat();
        dog2.Yelp();
    }
}*/

/*interface IAnimal
{
    void Eat();
}

interface ICat
{
    void Cry();
}

class Cat : IAnimal, ICat
{
    public void Eat()
    {
        Console.WriteLine("고양이가 먹는다");
    }
    public void Cry()
    {
        Console.WriteLine("고양이가 야옹한다.");
    }
}

class Program
{ 
    static void Main()
    {
        Cat  cat1 = new Cat();
        Cat  cat2 = new Cat();

        cat1.Eat();
        cat2.Cry();
    }
}*/

/*interface IAnimal
{
    void Eat();
}

interface IDog : IAnimal
{
    void Yelp();
}

interface ICat : IAnimal
{
    void Meow();
}


class Dog : IDog
{
    private string name;

    public Dog(string name)
    {
        this.name = name;
    }

    public void Eat()
    {
        Console.WriteLine($"{name}개가 먹는다.");
    }

    public void Yelp()
    {
        Console.WriteLine($"{name}개가 짖는다.");
    }


}

class Cat : ICat
{
    private string name;
    public Cat(string name)
    {
        this.name = name;
    }
    public void Eat() 
    {
        Console.WriteLine($"{name}고양이가 먹는다.");
    }

    public void Meow()
    {
        Console.WriteLine($"{name}고양이가 야옹한다.");
    }

}

class Program
{
    static void Main()
    {
        List<IAnimal> animals = new List<IAnimal>();

        IDog dogA = new Dog("A");
        IDog dogB = new Dog("B");
        ICat catA = new Cat("A");
        ICat catB = new Cat("B");

        animals.Add(dogA);
        animals.Add(dogB);
        animals.Add(catA);
        animals.Add(catB);

        foreach(IAnimal animal in animals)
        {
            animal.Eat();
            if(animal is IDog dog)
            {
                dog.Yelp();
            }
            else if(animal is ICat cat)
            {
                cat.Meow();
            }
        }
    }
}*/
public abstract class PlayBase
{
    // 멤버 변수
    public int Id { get; set; }
    public bool Active { get; set; }

    // 추상 메소드 Play() 선언
    public abstract void Play();
}

public class PlayChild : PlayBase
{
    // 추가된 멤버 변수
    public string Name { get; set; }

    // Play 메소드 재정의
    public override void Play()
    {
        Console.WriteLine($"{Id} - {Name}");
        if (Active)
        {
            Console.WriteLine("운동한다.");
        }
    }
}

class Program
{
    static void Main()
    {
        // PlayChild 객체 생성
        PlayChild child1 = new PlayChild { Id = 1, Name = "홍길동", Active = true };
        PlayChild child2 = new PlayChild { Id = 2, Name = "김길자", Active = false };

        // Play 메소드 호출
        child1.Play();
        child2.Play();
    }
}

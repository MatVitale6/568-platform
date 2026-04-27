namespace Five68.Model
{
	public class Employee
	{
		public required Guid ProfileId { get; set; } // PK and FK on Profile
		public string FiscalCode { get; set; } = null!;
		public string Phone { get; set; } = null!;
		public DateOnly? ContractEnd { get; set; }
		public bool Invited { get; set; } = false;
		public DateTime CreatedAt { get; set; }
		public DateTime UpdatedAt { get; set; }
		public Profile Profile { get; set; } = null!;
	}
}
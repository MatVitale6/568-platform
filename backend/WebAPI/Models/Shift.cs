namespace Five68.Models
{
    public class Shift
    {
        public required Guid Id { get; set; }
        public required DateTime WorkDate { get; set; }
        public bool IsClosed { get; set; } = false;
        public Guid? CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; } = DateTime.Now;

        public User Creator { get; set; } = null!;
        public ICollection<ShiftAssignment> Assignments { get; set; } = [];
        public ICollection<SwapRequest> SwapRequests { get; set; } = [];
    }
}
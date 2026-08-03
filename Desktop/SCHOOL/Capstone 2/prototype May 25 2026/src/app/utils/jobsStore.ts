// Centralized jobs store for Job Board management
export type JobType = {
  id: string;
  title: string;
  description: string;
  type: string;
  duration: string;
  status: 'active' | 'closed' | 'archived';
  postedDate?: string;
  location?: string;
  requirements?: string[];
  responsibilities?: string[];
};

type Subscriber = () => void;

class JobsStore {
  private jobs: JobType[] = [
    {
      id: 'JOB-001',
      title: 'Print Shop Assistant',
      description: 'Assist customers with printing services, operate printing equipment, and maintain inventory.',
      type: 'Part-time',
      duration: '20 hours/week',
      status: 'active',
      postedDate: '2026-04-15',
      location: 'Main Shop',
      requirements: ['Basic computer skills', 'Customer service experience', 'Attention to detail'],
      responsibilities: ['Assist customers with orders', 'Operate printers and copiers', 'Maintain supplies inventory']
    },
    {
      id: 'JOB-002',
      title: 'Graphic Designer',
      description: 'Create custom designs for customers, edit layouts, and provide design consultation.',
      type: 'Full-time',
      duration: '40 hours/week',
      status: 'active',
      postedDate: '2026-04-10',
      location: 'Main Shop',
      requirements: ['Proficiency in Adobe Creative Suite', '2+ years design experience', 'Portfolio required'],
      responsibilities: ['Design custom materials', 'Consult with customers', 'Prepare files for printing']
    },
    {
      id: 'JOB-003',
      title: 'Customer Service Representative',
      description: 'Handle customer inquiries, process orders, and manage online order system.',
      type: 'Full-time',
      duration: '40 hours/week',
      status: 'active',
      postedDate: '2026-04-20',
      location: 'Main Shop',
      requirements: ['Excellent communication skills', 'Computer proficiency', '1+ year experience'],
      responsibilities: ['Answer customer inquiries', 'Process orders', 'Manage order tracking system']
    }
  ];
  private subscribers: Set<Subscriber> = new Set();

  getJobs(): JobType[] {
    return [...this.jobs];
  }

  getActiveJobs(): JobType[] {
    return this.jobs.filter(job => job.status === 'active');
  }

  getArchivedJobs(): JobType[] {
    return this.jobs.filter(job => job.status === 'archived');
  }

  getJobById(id: string): JobType | undefined {
    return this.jobs.find(job => job.id === id);
  }

  archiveJob(id: string): void {
    this.updateJob(id, { status: 'archived' });
  }

  unarchiveJob(id: string): void {
    this.updateJob(id, { status: 'active' });
  }

  addJob(job: JobType): void {
    this.jobs = [...this.jobs, job];
    this.notify();
  }

  updateJob(id: string, updates: Partial<JobType>): void {
    this.jobs = this.jobs.map(job =>
      job.id === id ? { ...job, ...updates } : job
    );
    this.notify();
  }

  deleteJob(id: string): void {
    this.jobs = this.jobs.filter(job => job.id !== id);
    this.notify();
  }

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(): void {
    this.subscribers.forEach(callback => callback());
  }
}

export const jobsStore = new JobsStore();

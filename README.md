Ticket Access and Location-Based Visibility Rules

1. Admin Access

* Admin has full access to all locations and all tickets(when to change orginazation change and able to see all location ticket).
* Admin can:

  * View all tickets when drop down to change orgnization(hansa direct to hansa cequity or autosense all locations)
  * Edit tickets
  * Assign tickets
  * Manage users and team permissions
  

2. Manager Access(It service,DBA)

* Admin can provide Manager access with the following permissions:

  * View tickets for their assigned location
  * Edit tickets
  * Assign tickets to employees under their team/location 
  * Manager View all tickets when drop down to change orgnization(hansa direct to hansa cequity or autosense all locations)

3. Employee Access

* Employees can only access tickets assigned to them.
* Employees are allowed to:

  * Update ticket status
  * Add comments or work notes
  * Submit ticket updates
* Employees should not have permission to reassign tickets or access other location tickets.

4. User Access

* Users can only:

  * Generate/Create tickets
  * View their own tickets

5. Location-Based Ticket Routing

* When a user creates a ticket from Location A, the ticket must be assigned only to the respective team of Location A (such as IT Service, DBA, Help Desk, etc.).
* The ticket must not be visible or transferred automatically to Location B, even if the same team exists there.

6. Location Change Scenario

* If a user is later transferred from Location A to Location B:

  * Previously created tickets from Location A should remain linked to Location A.
  * Those old tickets should not appear under Location B ticket listings.
  * New tickets created after the transfer should follow Location B routing rules.

7. Ticket Visibility Rule

* Ticket visibility must always depend on:

  * Ticket creation location
  * Assigned team
  * User role and permissions
* Ticket location should remain fixed based on the original creation location.
